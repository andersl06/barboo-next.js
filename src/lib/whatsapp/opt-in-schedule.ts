import { Client } from "@upstash/qstash"

export async function scheduleWhatsappOptInMessage(appointmentId: string) {
  const token = process.env.QSTASH_TOKEN?.trim()
  const appUrl = process.env.APP_URL?.trim()

  if (!token || !appUrl) {
    return { scheduled: false, reason: "MISSING_CONFIG" as const }
  }

  const url = `${appUrl.replace(/\/+$/, "")}/api/whatsapp/opt-in/schedule`
  const client = new Client({
    token,
    baseUrl: process.env.QSTASH_URL?.trim() || undefined,
  })

  try {
    await client.publishJSON({
      url,
      body: { appointmentId },
      delay: "60s",
    })
    return { scheduled: true as const }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return { scheduled: false as const, reason: message }
  }
}
