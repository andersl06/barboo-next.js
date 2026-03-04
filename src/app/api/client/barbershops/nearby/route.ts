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
        "Ative e salve sua localizacao para buscar barbearias proximas.",
        403,
        [
          {
            field: "location",
            message:
              "Localizacao obrigatoria para busca por proximidade. Acesse por link direto para continuar sem localizacao.",
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
      return failure("VALIDATION_ERROR", "Parametro limit invalido.", 400, [
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
      return failure("VALIDATION_ERROR", "Parametro radiusKm invalido.", 400, [
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

    const candidates = await prisma.barbershop.findMany({
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
      },
      take: 200,
    })

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
