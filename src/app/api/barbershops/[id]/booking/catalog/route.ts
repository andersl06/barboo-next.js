import { prisma } from "@/lib/db/prisma"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { getClientIp } from "@/lib/http/client-ip"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { rateLimit } from "@/lib/security/rate-limit"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: barbershopId } = await params

    const ip = getClientIp(req)
    const allowed = rateLimit(`booking:catalog:${barbershopId}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 120,
    })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisicoes. Tente novamente.", 429)
    }

    const status = await requireActiveBarbershop(barbershopId)
    if ("error" in status) {
      return failure(status.code, status.message, status.status)
    }

    const [categories, uncategorizedServices] = await Promise.all([
      prisma.barbershopCategory.findMany({
        where: {
          barbershopId,
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          description: true,
          services: {
            where: {
              isActive: true,
            },
            orderBy: {
              name: "asc",
            },
            select: {
              id: true,
              name: true,
              description: true,
              priceCents: true,
              durationMinutes: true,
            },
          },
        },
      }),
      prisma.barbershopService.findMany({
        where: {
          barbershopId,
          isActive: true,
          categoryId: null,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          description: true,
          priceCents: true,
          durationMinutes: true,
        },
      }),
    ])

    return success({
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        services: category.services,
      })),
      uncategorizedServices,
    })
  } catch (err) {
    return handleError(err)
  }
}
