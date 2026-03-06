import { Prisma } from "@prisma/client"
import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { failure, success } from "@/lib/http/api-response"
import { getClientIp } from "@/lib/http/client-ip"
import { handleError } from "@/lib/http/error-handler"
import { rateLimit } from "@/lib/security/rate-limit"

type ViewFilter = "upcoming" | "past" | "all"

function parseView(rawValue: string | null): ViewFilter {
  if (rawValue === "upcoming") return "upcoming"
  if (rawValue === "past") return "past"
  return "all"
}

function parseLimit(value: string | null) {
  if (!value) return 120
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return 120
  return Math.min(Math.max(parsed, 1), 300)
}

function resolveDisplayStatus(
  status: "PENDING" | "CONFIRMED" | "CANCELED" | "REJECTED" | "COMPLETED",
  endAt: Date,
  now: Date
) {
  if (status === "COMPLETED") {
    return "COMPLETED" as const
  }

  if (status === "CONFIRMED" && endAt.getTime() <= now.getTime()) {
    return "COMPLETED" as const
  }

  return status
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const ip = getClientIp(req)
    const allowed = rateLimit(`appointments:my:${auth.user.id}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 120,
    })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisicoes. Tente novamente.", 429)
    }

    const url = new URL(req.url)
    const view = parseView(url.searchParams.get("view"))
    const limit = parseLimit(url.searchParams.get("limit"))
    const now = new Date()

    const where: Prisma.BarbershopAppointmentWhereInput = {
      clientUserId: auth.user.id,
    }

    if (view === "upcoming") {
      where.startAt = { gte: now }
      where.status = { in: ["PENDING", "CONFIRMED"] }
    } else if (view === "past") {
      where.OR = [
        {
          startAt: { lt: now },
        },
        {
          status: { in: ["CANCELED", "REJECTED"] },
        },
      ]
    }

    const appointments = await prisma.barbershopAppointment.findMany({
      where,
      orderBy: {
        startAt: view === "past" ? "desc" : "asc",
      },
      take: limit,
      select: {
        id: true,
        barbershopId: true,
        serviceId: true,
        barberUserId: true,
        startAt: true,
        endAt: true,
        status: true,
        servicePriceCents: true,
        serviceFeeCents: true,
        totalPriceCents: true,
        canceledAt: true,
        confirmedAt: true,
        createdAt: true,
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
            priceCents: true,
          },
        },
        barberUser: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    })

    return success({
      view,
      count: appointments.length,
      items: appointments.map((appointment) => {
        const latestCancelableTime = new Date(appointment.startAt.getTime() - 30 * 60 * 1000)
        const displayStatus = resolveDisplayStatus(appointment.status, appointment.endAt, now)
        const isUpcoming = appointment.startAt.getTime() >= now.getTime()
        const canCancel =
          isUpcoming &&
          (appointment.status === "PENDING" || appointment.status === "CONFIRMED") &&
          now.getTime() <= latestCancelableTime.getTime()

        return {
          ...appointment,
          displayStatus,
          canCancel,
          latestCancelableAt: latestCancelableTime,
          isUpcoming,
        }
      }),
    })
  } catch (err) {
    return handleError(err)
  }
}
