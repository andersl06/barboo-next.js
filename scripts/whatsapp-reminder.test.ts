import assert from "node:assert/strict"
import {
  buildWhatsappReminderLink,
  isWithinNext24h,
} from "../src/lib/whatsapp/reminders"
import { createMemoryRateLimiter } from "../src/lib/whatsapp/rate-limit"
import { dedupeInboundMessages } from "../src/lib/whatsapp/dedupe"
import { isWhatsappWindowOpen } from "../src/lib/whatsapp/window"

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`OK  - ${name}`)
  } catch (error) {
    console.error(`FAIL - ${name}`)
    throw error
  }
}

run("isWithinNext24h returns true for dates within 24h", () => {
  const now = new Date("2026-03-05T10:00:00.000-03:00")
  const within = new Date("2026-03-06T09:59:00.000-03:00")
  assert.equal(isWithinNext24h(within, now), true)
})

run("isWithinNext24h returns false for past or beyond 24h", () => {
  const now = new Date("2026-03-05T10:00:00.000-03:00")
  const past = new Date("2026-03-05T09:59:00.000-03:00")
  const beyond = new Date("2026-03-06T10:01:00.000-03:00")
  assert.equal(isWithinNext24h(past, now), false)
  assert.equal(isWithinNext24h(beyond, now), false)
})

run("buildWhatsappReminderLink encodes message and uses E.164 number", () => {
  const url = buildWhatsappReminderLink({
    appointmentId: "apt_123",
  })

  assert.ok(url.startsWith("https://wa.me/5521971878085?text="))
  const encoded = url.split("text=")[1] ?? ""
  const decoded = decodeURIComponent(encoded)

  assert.ok(
    decoded.includes("Olá! Quero ativar lembretes e atualizações sobre meu compromisso no Barboo.")
  )
})

run("isWhatsappWindowOpen detects last inbound within 24h", () => {
  const now = new Date("2026-03-05T10:00:00.000-03:00")
  const within = new Date("2026-03-04T12:00:00.000-03:00")
  const beyond = new Date("2026-03-04T08:00:00.000-03:00")

  assert.equal(isWhatsappWindowOpen(within, now), true)
  assert.equal(isWhatsappWindowOpen(beyond, now), false)
  assert.equal(isWhatsappWindowOpen(null, now), false)
})

run("memory rate limit blocks after max per minute", () => {
  const limiter = createMemoryRateLimiter()
  const now = new Date("2026-03-05T10:00:00.000Z")

  assert.equal(limiter.check("5521999999999", now, 2).allowed, true)
  assert.equal(limiter.check("5521999999999", now, 2).allowed, true)
  assert.equal(limiter.check("5521999999999", now, 2).allowed, false)
})

run("dedupeInboundMessages removes duplicate message ids", () => {
  const now = new Date("2026-03-05T10:00:00.000Z")
  const deduped = dedupeInboundMessages([
    { waId: "1", messageId: "msg-1", receivedAt: now },
    { waId: "1", messageId: "msg-1", receivedAt: now },
    { waId: "2", messageId: "msg-2", receivedAt: now },
  ])

  assert.equal(deduped.length, 2)
  assert.equal(deduped[0]?.messageId, "msg-1")
  assert.equal(deduped[1]?.messageId, "msg-2")
})

console.log("All WhatsApp reminder tests passed.")
