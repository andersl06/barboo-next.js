import { Prisma } from "@prisma/client"
import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"

type AppointmentScope = "CLIENT" | "BARBER" | "OWNER"

const HISTORY_STATUSES = ["CANCELED", "REJECTED", "COMPLETED"] as const

function parseScope(rawValue: string | null): AppointmentScope {
  if (rawValue === "barber") return "BARBER"
  if (rawValue === "owner") return "OWNER"
  return "CLIENT"
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const url = new URL(req.url)
    const scope = parseScope(url.searchParams.get("scope"))

    const [ownerMembership, barberMembership] = await Promise.all([
      prisma.barbershopMembership.findFirst({
        where: {
          userId: auth.user.id,
          role: "OWNER",
          isActive: true,
        },
        select: {
          barbershopId: true,
        },
      }),
      prisma.barbershopMembership.findFirst({
        where: {
          userId: auth.user.id,
          role: "BARBER",
          isActive: true,
        },
        select: {
          barbershopId: true,
        },
      }),
    ])

    if (scope === "OWNER" && !ownerMembership) {
      return failure("FORBIDDEN", "Acesso owner não autorizado.", 403)
    }

    if (scope === "BARBER" && !barberMembership && !ownerMembership) {
      return failure("FORBIDDEN", "Acesso barber não autorizado.", 403)
    }

    const baseWhere: Prisma.BarbershopAppointmentWhereInput =
      scope === "OWNER"
        ? { barbershopId: ownerMembership?.barbershopId }
        : scope === "BARBER"
          ? { barberUserId: auth.user.id }
          : { clientUserId: auth.user.id }

    const now = new Date()

    const [nextItem, historyItem, upcomingCount, historyCount] = await Promise.all([
      prisma.barbershopAppointment.findFirst({
        where: {
          ...baseWhere,
          status: "CONFIRMED",
          startAt: {
            gte: now,
          },
        },
        orderBy: {
          startAt: "asc",
        },
        select: {
          id: true,
          barbershopId: true,
          startAt: true,
          endAt: true,
          status: true,
          barbershop: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
            },
          },
          barberUser: {
            select: {
              id: true,
              name: true,
            },
          },
          clientUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.barbershopAppointment.findFirst({
        where: {
          ...baseWhere,
          OR: [
            {
              status: {
                in: [...HISTORY_STATUSES],
              },
            },
            {
              status: "CONFIRMED",
              startAt: {
                lt: now,
              },
            },
          ],
        },
        orderBy: {
          startAt: "desc",
        },
        select: {
          id: true,
          barbershopId: true,
          startAt: true,
          endAt: true,
          status: true,
          barbershop: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
            },
          },
          barberUser: {
            select: {
              id: true,
              name: true,
            },
          },
          clientUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.barbershopAppointment.count({
        where: {
          ...baseWhere,
          status: "CONFIRMED",
          startAt: {
            gte: now,
          },
        },
      }),
      prisma.barbershopAppointment.count({
        where: {
          ...baseWhere,
          OR: [
            {
              status: {
                in: [...HISTORY_STATUSES],
              },
            },
            {
              status: "CONFIRMED",
              startAt: {
                lt: now,
              },
            },
          ],
        },
      }),
    ])

    return success({
      scope,
      next: nextItem,
      history: historyItem,
      upcomingCount,
      historyCount,
    })
  } catch (err) {
    return handleError(err)
  }
}
