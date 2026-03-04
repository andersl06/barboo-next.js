import {
  buildAvailableSlots,
  getBusinessDateBounds,
  getBusinessDateFromDate,
} from "@/lib/appointments/availability"
import { getBookableBarber } from "@/lib/appointments/bookable-barbers"
import { requireAuth } from "@/lib/auth/require-auth"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { prisma } from "@/lib/db/prisma"
import { APPOINTMENT_ERRORS } from "@/lib/errors/appointment-errors"
import { getClientIp } from "@/lib/http/client-ip"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { rateLimit } from "@/lib/security/rate-limit"
import { createAppointmentSchema } from "@/lib/validators/appointment"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: barbershopId } = await params

    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const ip = getClientIp(req)
    const allowed = rateLimit(`appointments:create:${auth.user.id}:${barbershopId}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 40,
    })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisicoes. Tente novamente.", 429)
    }

    const status = await requireActiveBarbershop(barbershopId)
    if ("error" in status) {
      return failure(status.code, status.message, status.status)
    }

    const parsed = createAppointmentSchema.safeParse(await req.json())
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

    if (parsed.data.barbershopId && parsed.data.barbershopId !== barbershopId) {
      return failure("BAD_REQUEST", "barbershopId do payload difere da URL.", 400)
    }

    const requestedStartAt = new Date(parsed.data.startAt)
    if (Number.isNaN(requestedStartAt.getTime())) {
      return failure(
        APPOINTMENT_ERRORS.INVALID_START_AT.code,
        APPOINTMENT_ERRORS.INVALID_START_AT.message,
        400
      )
    }

    const now = new Date()
    if (requestedStartAt <= now) {
      return failure(
        APPOINTMENT_ERRORS.SLOT_UNAVAILABLE.code,
        APPOINTMENT_ERRORS.SLOT_UNAVAILABLE.message,
        409
      )
    }

    const [service, barber, barbershop] = await Promise.all([
      prisma.barbershopService.findFirst({
        where: {
          id: parsed.data.serviceId,
          barbershopId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          durationMinutes: true,
          priceCents: true,
        },
      }),
      getBookableBarber(barbershopId, parsed.data.barberId),
      prisma.barbershop.findUnique({
        where: { id: barbershopId },
        select: {
          id: true,
          name: true,
          openingHours: true,
        },
      }),
    ])

    if (!service) {
      return failure(
        APPOINTMENT_ERRORS.SERVICE_NOT_FOUND.code,
        APPOINTMENT_ERRORS.SERVICE_NOT_FOUND.message,
        404
      )
    }

    if (!barber) {
      return failure(
        APPOINTMENT_ERRORS.BARBER_NOT_FOUND.code,
        APPOINTMENT_ERRORS.BARBER_NOT_FOUND.message,
        404
      )
    }

    if (!barbershop) {
      return failure("BARBERSHOP_NOT_FOUND", "Barbearia nao encontrada.", 404)
    }

    const businessDate = getBusinessDateFromDate(requestedStartAt)
    const { start: dayStart, end: dayEnd } = getBusinessDateBounds(businessDate)

    const [blocks, busyAppointments] = await Promise.all([
      prisma.barberBlock.findMany({
        where: {
          barbershopId,
          barberUserId: barber.userId,
          date: new Date(`${businessDate}T00:00:00.000Z`),
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
      date: businessDate,
      serviceDuration: service.durationMinutes,
      openingHours: barbershop.openingHours,
      weeklySchedule: barber.weeklySchedule,
      blocks,
      busyRanges: busyAppointments,
      stepMinutes: 30,
    })

    const selectedSlot = slots.find(
      (slot) => slot.startAt.getTime() === requestedStartAt.getTime()
    )

    if (!selectedSlot) {
      return failure(
        APPOINTMENT_ERRORS.SLOT_UNAVAILABLE.code,
        APPOINTMENT_ERRORS.SLOT_UNAVAILABLE.message,
        409
      )
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${barber.userId} FOR UPDATE`

      const conflict = await tx.barbershopAppointment.findFirst({
        where: {
          barbershopId,
          barberUserId: barber.userId,
          status: {
            in: ["PENDING", "CONFIRMED"],
          },
          startAt: {
            lt: selectedSlot.endAt,
          },
          endAt: {
            gt: selectedSlot.startAt,
          },
        },
        select: { id: true },
      })

      if (conflict) {
        return null
      }

      return tx.barbershopAppointment.create({
        data: {
          barbershopId,
          serviceId: service.id,
          clientUserId: auth.user.id,
          barberUserId: barber.userId,
          startAt: selectedSlot.startAt,
          endAt: selectedSlot.endAt,
          status: "PENDING",
        },
        select: {
          id: true,
          status: true,
          startAt: true,
          endAt: true,
          createdAt: true,
        },
      })
    })

    if (!created) {
      return failure(
        APPOINTMENT_ERRORS.SLOT_UNAVAILABLE.code,
        APPOINTMENT_ERRORS.SLOT_UNAVAILABLE.message,
        409
      )
    }

    return success(
      {
        ...created,
        barbershopId,
        barbershopName: barbershop.name,
        service: {
          id: service.id,
          name: service.name,
          durationMinutes: service.durationMinutes,
          priceCents: service.priceCents,
        },
        barber: {
          userId: barber.userId,
          name: barber.name,
        },
      },
      201
    )
  } catch (err) {
    return handleError(err)
  }
}
