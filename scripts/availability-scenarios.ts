import assert from "node:assert/strict"
import {
  buildAvailableSlots,
  toBusinessDateTime,
} from "../src/lib/appointments/availability"

type DayWindow = { enabled: boolean; start: string; end: string }
type Schedule = Record<string, DayWindow>

function minutesToTime(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function buildTimes(start: string, end: string, stepMinutes: number, duration: number) {
  const [startHour, startMinute] = start.split(":").map(Number)
  const [endHour, endMinute] = end.split(":").map(Number)
  const startTotal = startHour * 60 + startMinute
  const endTotal = endHour * 60 + endMinute
  const times: string[] = []

  for (let current = startTotal; current + duration <= endTotal; current += stepMinutes) {
    times.push(minutesToTime(current))
  }

  return times
}

function runScenario(name: string, fn: () => void) {
  try {
    fn()
    console.log(`OK  - ${name}`)
  } catch (error) {
    console.error(`FAIL - ${name}`)
    throw error
  }
}

const DATE_MONDAY = "2026-03-02"
const openingHours: Schedule = {
  monday: { enabled: true, start: "09:00", end: "18:00" },
}
const barberSchedule: Schedule = {
  monday: { enabled: true, start: "10:00", end: "17:00" },
}

runScenario("Intersecao openingHours + weeklySchedule", () => {
  const slots = buildAvailableSlots({
    date: DATE_MONDAY,
    serviceDuration: 60,
    openingHours,
    weeklySchedule: barberSchedule,
    blocks: [],
    busyRanges: [],
    stepMinutes: 30,
    now: new Date("2026-03-01T12:00:00.000-03:00"),
  })
  const times = slots.map((slot) => slot.time)
  const expected = buildTimes("10:00", "17:00", 30, 60)
  assert.deepEqual(times, expected)
})

runScenario("Bloqueio de dia inteiro remove todos os slots", () => {
  const slots = buildAvailableSlots({
    date: DATE_MONDAY,
    serviceDuration: 60,
    openingHours,
    weeklySchedule: barberSchedule,
    blocks: [{ allDay: true, startTime: null, endTime: null }],
    busyRanges: [],
    stepMinutes: 30,
    now: new Date("2026-03-01T12:00:00.000-03:00"),
  })
  assert.equal(slots.length, 0)
})

runScenario("Bloqueio parcial remove apenas os slots conflitantes", () => {
  const slots = buildAvailableSlots({
    date: DATE_MONDAY,
    serviceDuration: 60,
    openingHours,
    weeklySchedule: barberSchedule,
    blocks: [{ allDay: false, startTime: "12:00", endTime: "13:30" }],
    busyRanges: [],
    stepMinutes: 30,
    now: new Date("2026-03-01T12:00:00.000-03:00"),
  })
  const times = slots.map((slot) => slot.time)
  assert.equal(times.includes("12:00"), false)
  assert.equal(times.includes("12:30"), false)
  assert.equal(times.includes("13:00"), false)
  assert.equal(times.includes("13:30"), true)
})

runScenario("Conflito com agendamento confirmado remove slots", () => {
  const slots = buildAvailableSlots({
    date: DATE_MONDAY,
    serviceDuration: 60,
    openingHours,
    weeklySchedule: barberSchedule,
    blocks: [],
    busyRanges: [
      {
        startAt: toBusinessDateTime(DATE_MONDAY, "14:00"),
        endAt: toBusinessDateTime(DATE_MONDAY, "15:00"),
      },
    ],
    stepMinutes: 30,
    now: new Date("2026-03-01T12:00:00.000-03:00"),
  })
  const times = slots.map((slot) => slot.time)
  assert.equal(times.includes("14:00"), false)
  assert.equal(times.includes("14:30"), false)
  assert.equal(times.includes("15:00"), true)
})

runScenario("Horarios passados do dia atual nao aparecem", () => {
  const slots = buildAvailableSlots({
    date: DATE_MONDAY,
    serviceDuration: 30,
    openingHours: { monday: { enabled: true, start: "14:00", end: "17:00" } },
    weeklySchedule: { monday: { enabled: true, start: "14:00", end: "17:00" } },
    blocks: [],
    busyRanges: [],
    stepMinutes: 30,
    now: new Date("2026-03-02T15:10:00.000-03:00"),
  })
  const times = slots.map((slot) => slot.time)
  assert.equal(times.includes("15:00"), false)
  assert.equal(times.includes("15:30"), true)
})

console.log("All availability scenarios passed.")
