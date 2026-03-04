import { requireAuth } from "@/lib/auth/require-auth"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { prisma } from "@/lib/db/prisma"
import { APPOINTMENT_ERRORS } from "@/lib/errors/appointment-errors"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireMembership } from "@/lib/membership/require-membership"
import { cancelAppointmentSchema } from "@/lib/validators/appointment"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; appointmentId: string }> }
) {
  try {
    const { id: barbershopId, appointmentId } = await params

    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const status = await requireActiveBarbershop(barbershopId)
    if ("error" in status) {
      return failure(status.code, status.message, status.status)
    }

    const parsed = cancelAppointmentSchema.safeParse(await req.json().catch(() => ({})))
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

    const appointment = await prisma.barbershopAppointment.findFirst({
      where: {
        id: appointmentId,
        barbershopId,
      },
      select: {
        id: true,
        clientUserId: true,
        barberUserId: true,
        status: true,
        startAt: true,
      },
    })

    if (!appointment) {
      return failure(APPOINTMENT_ERRORS.NOT_FOUND.code, APPOINTMENT_ERRORS.NOT_FOUND.message, 404)
    }

    const isClient = appointment.clientUserId === auth.user.id
    let isOwnerOrBarber = false

    if (!isClient) {
      const membership = await requireMembership(auth.user, barbershopId, ["OWNER", "BARBER"])
      if ("error" in membership) {
        return failure(
          APPOINTMENT_ERRORS.FORBIDDEN_CANCEL.code,
          APPOINTMENT_ERRORS.FORBIDDEN_CANCEL.message,
          403
        )
      }

      if (membership.role === "BARBER" && appointment.barberUserId !== auth.user.id) {
        return failure(
          APPOINTMENT_ERRORS.FORBIDDEN_CANCEL.code,
          APPOINTMENT_ERRORS.FORBIDDEN_CANCEL.message,
          403
        )
      }

      isOwnerOrBarber = true
    }

    if (!isClient && !isOwnerOrBarber) {
      return failure(
        APPOINTMENT_ERRORS.FORBIDDEN_CANCEL.code,
        APPOINTMENT_ERRORS.FORBIDDEN_CANCEL.message,
        403
      )
    }

    if (appointment.status === "CANCELED" || appointment.status === "REJECTED") {
      return failure(
        APPOINTMENT_ERRORS.INVALID_STATUS.code,
        APPOINTMENT_ERRORS.INVALID_STATUS.message,
        409
      )
    }

    if (isClient) {
      const latestCancelableTime = new Date(appointment.startAt.getTime() - 30 * 60 * 1000)
      if (new Date() > latestCancelableTime) {
        return failure(
          APPOINTMENT_ERRORS.CANCEL_WINDOW_EXPIRED.code,
          APPOINTMENT_ERRORS.CANCEL_WINDOW_EXPIRED.message,
          409
        )
      }
    }

    const updated = await prisma.barbershopAppointment.update({
      where: { id: appointment.id },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        canceledByUserId: auth.user.id,
        cancelReason: parsed.data.reason ?? null,
      },
      select: {
        id: true,
        status: true,
        canceledAt: true,
      },
    })

    return success(updated)
  } catch (err) {
    return handleError(err)
  }
}
