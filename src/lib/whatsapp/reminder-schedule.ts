import { Client } from "@upstash/qstash"

const REMINDER_LEAD_MS = 15 * 60 * 1000

function computeDelaySeconds(startAt: Date, now = new Date()) {
  const targetAt = startAt.getTime() - REMINDER_LEAD_MS
  const diffMs = targetAt - now.getTime()
  if (diffMs <= 0) return 0
  return Math.floor(diffMs / 1000)
}

export async function scheduleWhatsappReminderMessage(appointmentId: string, startAt: Date) {
  const token = process.env.QSTASH_TOKEN?.trim()
  const appUrl = process.env.APP_URL?.trim()

  if (!token || !appUrl) {
    return { scheduled: false as const, reason: "MISSING_CONFIG" }
  }

  const url = `${appUrl.replace(/\/+$/, "")}/api/whatsapp/reminder/schedule`
  const delaySeconds = computeDelaySeconds(startAt)
  const client = new Client({
    token,
    baseUrl: process.env.QSTASH_URL?.trim() || undefined,
  })

  try {
    await client.publishJSON({
      url,
      body: { appointmentId },
      ...(delaySeconds > 0 ? { delay: delaySeconds } : {}),
    })
    return { scheduled: true as const, delaySeconds }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return { scheduled: false as const, reason: message }
  }
}
