import { requireAuth } from "@/lib/auth/require-auth"
import {
  getBusinessDateBounds,
  normalizeBusinessDate,
} from "@/lib/appointments/availability"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import type { AppointmentStatus } from "@prisma/client"

const ALLOWED_STATUSES: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CANCELED",
  "REJECTED",
  "COMPLETED",
]

function parseStatuses(value: string | null): AppointmentStatus[] {
  if (!value) {
    return ["PENDING"]
  }

  const list = value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => ALLOWED_STATUSES.includes(item as AppointmentStatus)) as AppointmentStatus[]

  return list.length > 0 ? list : ["PENDING"]
}

function parseLimit(value: string | null) {
  if (!value) return 120
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return 120
  return Math.min(Math.max(parsed, 1), 300)
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const url = new URL(req.url)
    const statuses = parseStatuses(url.searchParams.get("status"))
    const date = url.searchParams.get("date")
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")
    const limit = parseLimit(url.searchParams.get("limit"))
    const startAtFilter: Prisma.DateTimeFilter = {}

    const where: Prisma.BarbershopAppointmentWhereInput = {
      barberUserId: auth.user.id,
      status: { in: statuses },
    }

    if (date) {
      const normalizedDate = normalizeBusinessDate(date)
      if (!normalizedDate) {
        return failure("VALIDATION_ERROR", "Data invalida. Use YYYY-MM-DD.", 400)
      }

      const bounds = getBusinessDateBounds(normalizedDate)
      startAtFilter.gte = bounds.start
      startAtFilter.lt = bounds.end
    }

    if (from || to) {
      const gte = from ? new Date(from) : undefined
      const lte = to ? new Date(to) : undefined

      if ((gte && Number.isNaN(gte.getTime())) || (lte && Number.isNaN(lte.getTime()))) {
        return failure("VALIDATION_ERROR", "Parametros from/to invalidos.", 400)
      }

      if (gte) startAtFilter.gte = gte
      if (lte) startAtFilter.lte = lte
    }

    if (Object.keys(startAtFilter).length > 0) {
      where.startAt = startAtFilter
    }

    const appointments = await prisma.barbershopAppointment.findMany({
      where,
      take: limit,
      orderBy: {
        startAt: "asc",
      },
      select: {
        id: true,
        barbershopId: true,
        startAt: true,
        endAt: true,
        status: true,
        createdAt: true,
        clientUser: {
          select: {
            id: true,
            name: true,
          },
        },
        barbershop: {
          select: {
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
      },
    })

    return success({
      count: appointments.length,
      items: appointments,
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2022") {
      return failure(
        "DB_SCHEMA_OUTDATED",
        "O schema do banco esta desatualizado para este endpoint. Execute as migrations e tente novamente.",
        500
      )
    }

    return handleError(err)
  }
}
