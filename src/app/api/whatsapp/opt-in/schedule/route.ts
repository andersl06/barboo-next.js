import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"
import { prisma } from "@/lib/db/prisma"
import { success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { normalizeWhatsappDigits } from "@/lib/whatsapp/normalize"
import { sendWhatsappOptInFreeForm, sendWhatsappOptInTemplate } from "@/lib/whatsapp/opt-in"
import { getWhatsappWindowStatus } from "@/lib/whatsapp/service"

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

async function handler(req: Request) {
  try {
    const payload = (await req.json()) as { appointmentId?: string | null }
    const appointmentId = typeof payload?.appointmentId === "string" ? payload.appointmentId : null

    if (!appointmentId) {
      return success({ skipped: true, reason: "MISSING_APPOINTMENT_ID" })
    }

    const appointment = await prisma.barbershopAppointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        status: true,
        startAt: true,
        whatsappOptInSentAt: true,
        clientUser: {
          select: { name: true, phone: true },
        },
        barbershop: {
          select: { name: true },
        },
      },
    })

    if (!appointment) {
      return success({ skipped: true, reason: "APPOINTMENT_NOT_FOUND" })
    }

    if (appointment.whatsappOptInSentAt) {
      return success({ skipped: true, reason: "ALREADY_SENT" })
    }

    if (!appointment.clientUser.phone) {
      return success({ skipped: true, reason: "MISSING_PHONE" })
    }

    if (appointment.status !== "PENDING") {
      return success({ skipped: true, reason: "STATUS_NOT_PENDING" })
    }

    const waIdDigits = normalizeWhatsappDigits(appointment.clientUser.phone)
    if (!waIdDigits) {
      return success({ skipped: true, reason: "INVALID_PHONE" })
    }

    const payloadData = {
      waIdDigits,
      customerName: appointment.clientUser.name,
      appointmentDate: formatDate(appointment.startAt),
      appointmentTime: formatTime(appointment.startAt),
      barbershopName: appointment.barbershop.name,
    }

    const { windowOpen } = await getWhatsappWindowStatus(waIdDigits)
    const result = windowOpen
      ? await sendWhatsappOptInFreeForm(payloadData)
      : await sendWhatsappOptInTemplate(payloadData)

    if (result.sent) {
      await prisma.barbershopAppointment.update({
        where: { id: appointment.id },
        data: { whatsappOptInSentAt: new Date() },
        select: { id: true },
      })
    }

    return success({
      skipped: false,
      sent: result.sent,
      mode: result.mode,
      errorCode: result.errorCode ?? null,
    })
  } catch (err) {
    return handleError(err)
  }
}

export const POST = verifySignatureAppRouter(handler)
