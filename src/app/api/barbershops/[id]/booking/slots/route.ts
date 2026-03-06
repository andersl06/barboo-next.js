import {
  buildAvailableSlots,
  getBusinessDateBounds,
  normalizeBusinessDate,
} from "@/lib/appointments/availability"
import { getBookableBarber } from "@/lib/appointments/bookable-barbers"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { prisma } from "@/lib/db/prisma"
import { APPOINTMENT_ERRORS } from "@/lib/errors/appointment-errors"
import { getClientIp } from "@/lib/http/client-ip"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { rateLimit } from "@/lib/security/rate-limit"
import { listSlotsSchema } from "@/lib/validators/appointment"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: barbershopId } = await params
    const url = new URL(req.url)

    const parsed = listSlotsSchema.safeParse({
      barberId: url.searchParams.get("barberId"),
      date: url.searchParams.get("date"),
      serviceDuration: url.searchParams.get("serviceDuration"),
    })

    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Erro de Validação",
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

    const { barberId, date, serviceDuration } = parsed.data
    const normalizedDate = normalizeBusinessDate(date)
    if (!normalizedDate) {
      return failure(
        APPOINTMENT_ERRORS.INVALID_DATE.code,
        APPOINTMENT_ERRORS.INVALID_DATE.message,
        400
      )
    }

    const ip = getClientIp(req)
    const allowed = rateLimit(`booking:slots:${barbershopId}:${barberId}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 180,
    })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisicoes. Tente novamente.", 429)
    }

    const status = await requireActiveBarbershop(barbershopId)
    if ("error" in status) {
      return failure(status.code, status.message, status.status)
    }

    const [barbershop, barber] = await Promise.all([
      prisma.barbershop.findUnique({
        where: { id: barbershopId },
        select: {
          id: true,
          openingHours: true,
        },
      }),
      getBookableBarber(barbershopId, barberId),
    ])

    if (!barbershop) {
      return failure("BARBERSHOP_NOT_FOUND", "Barbearia não encontrada.", 404)
    }

    if (!barber) {
      return failure(
        APPOINTMENT_ERRORS.BARBER_NOT_FOUND.code,
        APPOINTMENT_ERRORS.BARBER_NOT_FOUND.message,
        404
      )
    }

    const { start: dayStart, end: dayEnd } = getBusinessDateBounds(normalizedDate)

    const [blocks, busyAppointments] = await Promise.all([
      prisma.barberBlock.findMany({
        where: {
          barbershopId,
          barberUserId: barber.userId,
          date: new Date(`${normalizedDate}T00:00:00.000Z`),
        },
        select: {
          allDay: true,
          startTime: true,
          endTime: true,
        },
      }),
      prisma.barbershopAppointment.findMany({
        where: {
          barbershopId,
          barberUserId: barber.userId,
          status: {
            in: ["PENDING", "CONFIRMED"],
          },
          startAt: {
            lt: dayEnd,
          },
          endAt: {
            gt: dayStart,
          },
        },
        select: {
          startAt: true,
          endAt: true,
        },
      }),
    ])

    const slots = buildAvailableSlots({
      date: normalizedDate,
      serviceDuration,
      openingHours: barbershop.openingHours,
      weeklySchedule: barber.weeklySchedule,
      blocks,
      busyRanges: busyAppointments,
      stepMinutes: 30,
    })

    return success({
      date: normalizedDate,
      barber: {
        userId: barber.userId,
        name: barber.name,
      },
      serviceDuration,
      count: slots.length,
      items: slots.map((slot) => ({
        time: slot.time,
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString(),
      })),
    })
  } catch (err) {
    return handleError(err)
  }
}
