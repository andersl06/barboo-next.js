import { requireAuth } from "@/lib/auth/require-auth"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { prisma } from "@/lib/db/prisma"
import { APPOINTMENT_ERRORS } from "@/lib/errors/appointment-errors"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireSameOrigin } from "@/lib/http/require-origin"
import { requireMembership } from "@/lib/membership/require-membership"
import { sendWhatsappAppointmentConfirmation } from "@/lib/whatsapp/confirmations"
import { normalizeWhatsappDigits } from "@/lib/whatsapp/normalize"

const BUSINESS_TIMEZONE = "America/Sao_Paulo"

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: BUSINESS_TIMEZONE,
  }).format(value)
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeStyle: "short",
    timeZone: BUSINESS_TIMEZONE,
  }).format(value)
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; appointmentId: string }> }
) {
  try {
    const originCheck = requireSameOrigin(req)
    if (!originCheck.ok) {
      return failure("FORBIDDEN", originCheck.message, originCheck.status)
    }

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

    const details = await prisma.barbershopAppointment.findUnique({
      where: { id: appointment.id },
      select: {
        id: true,
        startAt: true,
        totalPriceCents: true,
        clientUser: {
          select: { name: true, phone: true },
        },
        barberUser: {
          select: { name: true },
        },
        service: {
          select: { name: true },
        },
      },
    })

    if (details?.clientUser.phone) {
      const waIdDigits = normalizeWhatsappDigits(details.clientUser.phone)
      const appointmentDate = formatDate(details.startAt)
      const appointmentTime = formatTime(details.startAt)

      try {
        await sendWhatsappAppointmentConfirmation({
          waIdDigits,
          customerName: details.clientUser.name,
          barberName: details.barberUser.name,
          serviceName: details.service.name,
          appointmentDate,
          appointmentTime,
          price: formatCurrency(details.totalPriceCents),
          appointmentId: details.id,
        })
      } catch (err) {
        console.warn("Falha ao enviar confirmação WhatsApp.", err)
      }
    }

    return success(updated)
  } catch (err) {
    return handleError(err)
  }
}
