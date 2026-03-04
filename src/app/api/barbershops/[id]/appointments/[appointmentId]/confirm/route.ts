import { requireAuth } from "@/lib/auth/require-auth"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { prisma } from "@/lib/db/prisma"
import { APPOINTMENT_ERRORS } from "@/lib/errors/appointment-errors"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireMembership } from "@/lib/membership/require-membership"

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

    const membership = await requireMembership(auth.user, barbershopId, ["OWNER", "BARBER"])
    if ("error" in membership) {
      return failure("FORBIDDEN", membership.message, membership.status)
    }

    const appointment = await prisma.barbershopAppointment.findFirst({
      where: {
        id: appointmentId,
        barbershopId,
      },
      select: {
        id: true,
        barberUserId: true,
        status: true,
      },
    })

    if (!appointment) {
      return failure(APPOINTMENT_ERRORS.NOT_FOUND.code, APPOINTMENT_ERRORS.NOT_FOUND.message, 404)
    }

    if (membership.role === "BARBER" && auth.user.id !== appointment.barberUserId) {
      return failure(
        APPOINTMENT_ERRORS.FORBIDDEN_CONFIRM.code,
        APPOINTMENT_ERRORS.FORBIDDEN_CONFIRM.message,
        403
      )
    }

    if (appointment.status !== "PENDING") {
      return failure(
        APPOINTMENT_ERRORS.INVALID_STATUS.code,
        "Somente agendamentos pendentes podem ser confirmados.",
        409
      )
    }

    const updated = await prisma.barbershopAppointment.update({
      where: { id: appointment.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        confirmedAt: true,
      },
    })

    return success(updated)
  } catch (err) {
    return handleError(err)
  }
}
