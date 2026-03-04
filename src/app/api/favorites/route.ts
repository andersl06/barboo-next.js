import { Prisma } from "@prisma/client"
import { z } from "zod"
import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { failure, success } from "@/lib/http/api-response"
import { getClientIp } from "@/lib/http/client-ip"
import { handleError } from "@/lib/http/error-handler"
import { rateLimit } from "@/lib/security/rate-limit"

const favoritePayloadSchema = z.object({
  barbershopId: z.string().uuid("barbershopId invalido."),
})

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
    const allowed = rateLimit(`favorites:list:${auth.user.id}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 90,
    })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisicoes. Tente novamente.", 429)
    }

    const favorites = await prisma.favoriteBarbershop.findMany({
      where: {
        userId: auth.user.id,
        barbershop: {
          status: "ATIVA",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        barbershopId: true,
        createdAt: true,
        barbershop: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            logoUrl: true,
            coverUrl: true,
            city: true,
            neighborhood: true,
            latitude: true,
            longitude: true,
            avgPrice: true,
            avgTimeMinutes: true,
            services: {
              where: { isActive: true },
              select: {
                avgRating: true,
                ratingCount: true,
              },
            },
          },
        },
      },
    }).catch((err) => {
      if (isFavoritesSchemaOutdatedError(err)) {
        return [] as Array<{
          id: string
          barbershopId: string
          createdAt: Date
          barbershop: {
            id: string
            slug: string | null
            name: string
            description: string | null
            logoUrl: string | null
            coverUrl: string | null
            city: string | null
            neighborhood: string | null
            latitude: Prisma.Decimal | null
            longitude: Prisma.Decimal | null
            avgPrice: Prisma.Decimal | null
            avgTimeMinutes: number | null
            services: Array<{ avgRating: Prisma.Decimal | null; ratingCount: number }>
          }
        }>
      }
      throw err
    })

    const latitude = auth.user.clientLatitude
    const longitude = auth.user.clientLongitude

    return success({
      count: favorites.length,
      items: favorites.map((favorite) => {
        const rating = resolveRating(favorite.barbershop.services)
        const hasCoordinates =
          favorite.barbershop.latitude !== null && favorite.barbershop.longitude !== null

        const distanceKm =
          hasCoordinates && latitude !== null && longitude !== null
            ? roundTo(
                haversineDistanceKm(
                  latitude,
                  longitude,
                  Number(favorite.barbershop.latitude),
                  Number(favorite.barbershop.longitude)
                ),
                2
              )
            : null

        return {
          id: favorite.id,
          barbershopId: favorite.barbershopId,
          createdAt: favorite.createdAt,
          isFavorited: true,
          barbershop: {
            id: favorite.barbershop.id,
            slug: favorite.barbershop.slug,
            name: favorite.barbershop.name,
            description: favorite.barbershop.description,
            logoUrl: favorite.barbershop.logoUrl,
            coverUrl: favorite.barbershop.coverUrl,
            city: favorite.barbershop.city,
            neighborhood: favorite.barbershop.neighborhood,
            avgPrice: favorite.barbershop.avgPrice !== null ? Number(favorite.barbershop.avgPrice) : null,
            avgTimeMinutes: favorite.barbershop.avgTimeMinutes,
            rating: rating.value,
            ratingCount: rating.count,
            distanceKm,
          },
        }
      }),
    })
  } catch (err) {
    return handleError(err)
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const ip = getClientIp(req)
    const allowed = rateLimit(`favorites:create:${auth.user.id}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 120,
    })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisicoes. Tente novamente.", 429)
    }

    const parsed = favoritePayloadSchema.safeParse(await req.json())
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Erro de validacao",
        400,
        parsed.error.issues.map((issue) => ({
          field:
            typeof issue.path[0] === "string" || typeof issue.path[0] === "number"
              ? issue.path[0]
              : undefined,
          message: issue.message,
        }))
      )
    }

    const barbershop = await prisma.barbershop.findFirst({
      where: {
        id: parsed.data.barbershopId,
        status: "ATIVA",
      },
      select: {
        id: true,
      },
    })

    if (!barbershop) {
      return failure("BARBERSHOP_NOT_FOUND", "Barbearia nao encontrada.", 404)
    }

    await prisma.favoriteBarbershop.upsert({
      where: {
        userId_barbershopId: {
          userId: auth.user.id,
          barbershopId: parsed.data.barbershopId,
        },
      },
      update: {},
      create: {
        userId: auth.user.id,
        barbershopId: parsed.data.barbershopId,
      },
      select: { id: true },
    }).catch((err) => {
      if (isFavoritesSchemaOutdatedError(err)) {
        return { id: "degraded" }
      }
      throw err
    })

    return success({
      favorited: true,
      barbershopId: parsed.data.barbershopId,
    })
  } catch (err) {
    return handleError(err)
  }
}
