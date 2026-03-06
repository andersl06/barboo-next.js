const WHATSAPP_REMINDER_PHONE = "5521971878085"
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export type WhatsappReminderPayload = {
  barbershopName?: string
  serviceName?: string
  barberName?: string | null
  appointmentStartAt?: string | Date
  appointmentId?: string
}

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value)
}

export function isWithinNext24h(dateTime: string | Date, now = new Date()) {
  const target = toDate(dateTime)
  if (Number.isNaN(target.getTime())) return false

  const diff = target.getTime() - now.getTime()
  return diff >= 0 && diff <= ONE_DAY_MS
}

export function buildWhatsappReminderLink(payload: WhatsappReminderPayload) {
  const lines = [
    "Olá! Quero ativar lembretes e atualizações sobre meu compromisso no Barboo.",
    payload.appointmentId ? `ID: ${payload.appointmentId}` : null,
  ].filter(Boolean)

  const text = lines.join("\n")
  const encodedText = encodeURIComponent(text)
  return `https://wa.me/${WHATSAPP_REMINDER_PHONE}?text=${encodedText}`
}
