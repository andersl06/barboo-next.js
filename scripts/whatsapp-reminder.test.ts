import assert from "node:assert/strict"
import {
  buildWhatsappReminderLink,
  isWithinNext24h,
} from "../src/lib/whatsapp/reminders"

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
    barbershopName: "Barbearia Central",
    serviceName: "Corte clássico",
    barberName: "João",
    appointmentStartAt: "2026-03-05T15:00:00.000-03:00",
  })

  assert.ok(url.startsWith("https://wa.me/5521971878085?text="))
  const encoded = url.split("text=")[1] ?? ""
  const decoded = decodeURIComponent(encoded)

  assert.ok(decoded.includes("Compromisso: Corte clássico"))
  assert.ok(decoded.includes("Barbearia: Barbearia Central"))
  assert.ok(decoded.includes("Barbeiro: João"))
  assert.ok(decoded.includes("Data e hora:"))
})

console.log("All WhatsApp reminder tests passed.")
