import { Prisma } from "@prisma/client"
import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { failure, success } from "@/lib/http/api-response"
import { getClientIp } from "@/lib/http/client-ip"
import { handleError } from "@/lib/http/error-handler"
import { rateLimit } from "@/lib/security/rate-limit"

function haversineDistanceKm(
  originLat: number,
  originLon: number,
  targetLat: number,
  targetLon: number
) {
  const earthRadiusKm = 6371
  const dLat = ((targetLat - originLat) * Math.PI) / 180
  const dLon = ((targetLon - originLon) * Math.PI) / 180
  const lat1 = (originLat * Math.PI) / 180
  const lat2 = (targetLat * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

function roundTo(value: number, fractionDigits: number) {
  const factor = 10 ** fractionDigits
  return Math.round(value * factor) / factor
}

function resolveRating(services: Array<{ avgRating: unknown; ratingCount: number }>) {
  const validServices = services
    .map((service) => {
      if (service.avgRating === null || service.ratingCount <= 0) return null
      const numericRating = Number(service.avgRating)
      if (!Number.isFinite(numericRating)) return null
      return {
        avgRating: numericRating,
        ratingCount: service.ratingCount,
      }
    })
    .filter((item): item is { avgRating: number; ratingCount: number } => item !== null)

  if (validServices.length === 0) {
    return { value: null, count: 0 }
  }

  const totalCount = validServices.reduce((sum, service) => sum + service.ratingCount, 0)
  if (totalCount <= 0) {
    return { value: null, count: 0 }
  }

  const weightedValue = validServices.reduce(
    (sum, service) => sum + service.avgRating * service.ratingCount,
    0
  ) / totalCount

  return {
    value: roundTo(weightedValue, 1),
    count: totalCount,
  }
}

function isFavoritesSchemaOutdatedError(err: unknown) {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
    return false
  }

  if (err.code !== "P2021" && err.code !== "P2022") {
    return false
  }

  const message = err.message.toLowerCase()
  const tableName = typeof err.meta?.table === "string" ? err.meta.table.toLowerCase() : ""
  const modelName = typeof err.meta?.modelName === "string" ? err.meta.modelName.toLowerCase() : ""

  return (
    message.includes("favorite") ||
    tableName.includes("favorite") ||
    modelName.includes("favorite")
  )
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const ip = getClientIp(req)
    const allowed = rateLimit(`client:barbershops:nearby:${auth.user.id}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 60,
    })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisicoes. Tente novamente.", 429)
    }

    if (
      auth.user.clientLatitude === null ||
      auth.user.clientLongitude === null
    ) {
      return failure(
        "CLIENT_LOCATION_REQUIRED",
        "Ative e salve Sua localização para buscar barbearias Próximas.",
        403,
        [
          {
            field: "location",
            message:
              "Localização obrigatória para busca por proximidade. Acesse por link direto para continuar sem Localização.",
          },
        ]
      )
    }

    const url = new URL(req.url)
    const limitParam = Number(url.searchParams.get("limit") ?? "20")
    const radiusParam = Number(url.searchParams.get("radiusKm") ?? "20")

    if (
      !Number.isFinite(limitParam) ||
      !Number.isInteger(limitParam) ||
      limitParam < 1 ||
      limitParam > 50
    ) {
      return failure("VALIDATION_ERROR", "parâmetro limit inválido.", 400, [
        {
          field: "limit",
          message: "Use um inteiro entre 1 e 50.",
        },
      ])
    }

    if (
      !Number.isFinite(radiusParam) ||
      radiusParam < 1 ||
      radiusParam > 100
    ) {
      return failure("VALIDATION_ERROR", "parâmetro radiusKm inválido.", 400, [
        {
          field: "radiusKm",
          message: "Use um valor entre 1 e 100 km.",
        },
      ])
    }

    const latitude = auth.user.clientLatitude
    const longitude = auth.user.clientLongitude
    const latitudeDelta = radiusParam / 111
    const cosine = Math.max(Math.cos((latitude * Math.PI) / 180), 0.01)
    const longitudeDelta = radiusParam / (111 * cosine)

    const [candidates, favorites] = await Promise.all([
      prisma.barbershop.findMany({
        where: {
          status: "ATIVA",
          latitude: {
            gte: latitude - latitudeDelta,
            lte: latitude + latitudeDelta,
            not: null,
          },
          longitude: {
            gte: longitude - longitudeDelta,
            lte: longitude + longitudeDelta,
            not: null,
          },
        },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          logoUrl: true,
          coverUrl: true,
          city: true,
          neighborhood: true,
          avgPrice: true,
          avgTimeMinutes: true,
          latitude: true,
          longitude: true,
          services: {
            where: { isActive: true },
            select: {
              avgRating: true,
              ratingCount: true,
            },
          },
        },
        take: 200,
      }),
      prisma.favoriteBarbershop.findMany({
        where: {
          userId: auth.user.id,
        },
        select: {
          barbershopId: true,
        },
      }).catch((err) => {
        if (isFavoritesSchemaOutdatedError(err)) {
          return [] as Array<{ barbershopId: string }>
        }
        throw err
      }),
    ])

    const favoriteBarbershopIds = new Set(favorites.map((item) => item.barbershopId))

    const nearby = candidates
      .map((shop) => {
        if (shop.latitude === null || shop.longitude === null) {
          return null
        }

        const shopLatitude = Number(shop.latitude)
        const shopLongitude = Number(shop.longitude)
        const distanceKm = haversineDistanceKm(
          latitude,
          longitude,
          shopLatitude,
          shopLongitude
        )

        if (distanceKm > radiusParam) {
          return null
        }

        const rating = resolveRating(shop.services)

        return {
          id: shop.id,
          slug: shop.slug,
          name: shop.name,
          description: shop.description,
          logoUrl: shop.logoUrl,
          coverUrl: shop.coverUrl,
          city: shop.city,
          neighborhood: shop.neighborhood,
          avgPrice: shop.avgPrice ? Number(shop.avgPrice) : null,
          avgTimeMinutes: shop.avgTimeMinutes,
          distanceKm: roundTo(distanceKm, 2),
          rating: rating.value,
          ratingCount: rating.count,
          isFavorited: favoriteBarbershopIds.has(shop.id),
        }
      })
      .filter((shop): shop is NonNullable<typeof shop> => shop !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limitParam)

    return success({
      origin: {
        latitude,
        longitude,
        radiusKm: radiusParam,
      },
      count: nearby.length,
      items: nearby,
    })
  } catch (err) {
    return handleError(err)
  }
}
