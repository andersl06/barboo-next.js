import { Prisma } from "@prisma/client"
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"
import { prisma } from "@/lib/db/prisma"
import { success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { normalizeWhatsappDigits } from "@/lib/whatsapp/normalize"
import { sendWhatsappReminderFreeForm, sendWhatsappReminderTemplate } from "@/lib/whatsapp/reminder-send"
import { getWhatsappWindowStatus } from "@/lib/whatsapp/service"

const BUSINESS_TIMEZONE = "America/Sao_Paulo"
const REMINDER_LEAD_MS = 15 * 60 * 1000
const EARLY_TOLERANCE_MS = 30 * 1000

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
    const rawBody = await req.text()
    const payload = rawBody
      ? (JSON.parse(rawBody) as { appointmentId?: string | null })
      : ({ appointmentId: null } as { appointmentId?: string | null })
    const appointmentId = typeof payload?.appointmentId === "string" ? payload.appointmentId : null

    if (!appointmentId) {
      return success({ skipped: true, reason: "MISSING_APPOINTMENT_ID" })
    }

    let supportsReminderSentAt = true
    let appointment:
      | {
          id: string
          status: "PENDING" | "CONFIRMED" | "CANCELED" | "REJECTED" | "COMPLETED"
          startAt: Date
          whatsappReminderSentAt: Date | null
          clientUser: { name: string; phone: string | null }
          barbershop: { name: string }
        }
      | {
          id: string
          status: "PENDING" | "CONFIRMED" | "CANCELED" | "REJECTED" | "COMPLETED"
          startAt: Date
          clientUser: { name: string; phone: string | null }
          barbershop: { name: string }
        }
      | null = null

    try {
      appointment = await prisma.barbershopAppointment.findUnique({
        where: { id: appointmentId },
        select: {
          id: true,
          status: true,
          startAt: true,
          whatsappReminderSentAt: true,
          clientUser: {
            select: { name: true, phone: true },
          },
          barbershop: {
            select: { name: true },
          },
        },
      })
    } catch (err) {
      const missingColumn =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2022"

      if (!missingColumn) {
        throw err
      }

      supportsReminderSentAt = false
      appointment = await prisma.barbershopAppointment.findUnique({
        where: { id: appointmentId },
        select: {
          id: true,
          status: true,
          startAt: true,
          clientUser: {
            select: { name: true, phone: true },
          },
          barbershop: {
            select: { name: true },
          },
        },
      })
    }

    if (!appointment) {
      return success({ skipped: true, reason: "APPOINTMENT_NOT_FOUND" })
    }

    if (supportsReminderSentAt && "whatsappReminderSentAt" in appointment && appointment.whatsappReminderSentAt) {
      return success({ skipped: true, reason: "ALREADY_SENT" })
    }

    if (appointment.status !== "CONFIRMED") {
      return success({ skipped: true, reason: "STATUS_NOT_CONFIRMED" })
    }

    if (!appointment.clientUser.phone) {
      return success({ skipped: true, reason: "MISSING_PHONE" })
    }

    const now = new Date()
    const msUntilStart = appointment.startAt.getTime() - now.getTime()
    if (msUntilStart <= 0) {
      return success({ skipped: true, reason: "STARTED_OR_PAST" })
    }

    if (msUntilStart > REMINDER_LEAD_MS + EARLY_TOLERANCE_MS) {
      return success({
        skipped: true,
        reason: "TOO_EARLY",
        secondsUntilReminderWindow: Math.floor((msUntilStart - REMINDER_LEAD_MS) / 1000),
      })
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
      ? await sendWhatsappReminderFreeForm(payloadData)
      : await sendWhatsappReminderTemplate(payloadData)

    if (!result.sent) {
      console.warn("Lembrete WhatsApp nao enviado.", {
        appointmentId: appointment.id,
        mode: result.mode,
        errorCode: result.errorCode ?? null,
        errorSubcode: result.errorSubcode ?? null,
        errorMessage: result.errorMessage ?? null,
      })
    }

    if (result.sent && supportsReminderSentAt) {
      await prisma.barbershopAppointment.update({
        where: { id: appointment.id },
        data: { whatsappReminderSentAt: new Date() },
        select: { id: true },
      })
    }

    return success({
      skipped: false,
      sent: result.sent,
      mode: result.mode,
      errorCode: result.errorCode ?? null,
      errorSubcode: result.errorSubcode ?? null,
      errorMessage: result.errorMessage ?? null,
    })
  } catch (err) {
    console.error("[whatsapp] reminder schedule handler failed", err)
    return handleError(err)
  }
}

export const POST = verifySignatureAppRouter(handler)
