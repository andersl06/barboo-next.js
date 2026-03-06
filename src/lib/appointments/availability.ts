type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday"

type DayWindow = {
  enabled: boolean
  start?: string
  end?: string
}

type BlockLike = {
  allDay: boolean
  startTime: string | null
  endTime: string | null
}

type BusyRange = {
  startAt: Date
  endAt: Date
}

type SlotItem = {
  time: string
  startAt: Date
  endAt: Date
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/
const BUSINESS_TIMEZONE = "America/Sao_Paulo"
const BUSINESS_UTC_OFFSET = "-03:00"

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseTimeToMinutes(value: string) {
  const [hourRaw, minuteRaw] = value.split(":")
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  return hour * 60 + minute
}

function minutesToTime(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function getDayKeyFromDate(date: string): DayKey {
  const [year, month, day] = date.split("-").map((value) => Number(value))
  const utcDay = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay()

  const map: Record<number, DayKey> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  }

  return map[utcDay]
}

function getDayWindow(source: unknown, dayKey: DayKey): DayWindow | null {
  if (!isObjectRecord(source)) {
    return null
  }

  const raw = source[dayKey]
  if (!isObjectRecord(raw)) {
    return null
  }

  const enabled = raw.enabled === true
  const start = typeof raw.start === "string" ? raw.start : undefined
  const end = typeof raw.end === "string" ? raw.end : undefined
  return { enabled, start, end }
}

function getBusinessDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const map = parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value
    }
    return acc
  }, {})

  return {
    year: map.year ?? "0000",
    month: map.month ?? "00",
    day: map.day ?? "00",
    hour: map.hour ?? "00",
    minute: map.minute ?? "00",
  }
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB
}

export function normalizeBusinessDate(date: string) {
  if (!DATE_REGEX.test(date)) {
    return null
  }

  const [year, month, day] = date.split("-").map((value) => Number(value))
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null
  }

  return date
}

export function toBusinessDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00.000${BUSINESS_UTC_OFFSET}`)
}

export function getBusinessDateFromDate(date: Date) {
  const parts = getBusinessDateParts(date)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function getBusinessTimeFromDate(date: Date) {
  const parts = getBusinessDateParts(date)
  return `${parts.hour}:${parts.minute}`
}

export function getNextBusinessDate(date: string) {
  const [year, month, day] = date.split("-").map((value) => Number(value))
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  probe.setUTCDate(probe.getUTCDate() + 1)
  const yyyy = probe.getUTCFullYear()
  const mm = String(probe.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(probe.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export function getBusinessDateBounds(date: string) {
  const start = toBusinessDateTime(date, "00:00")
  const end = toBusinessDateTime(getNextBusinessDate(date), "00:00")
  return { start, end }
}

export function buildAvailableSlots(params: {
  date: string
  serviceDuration: number
  openingHours: unknown
  weeklySchedule: unknown
  blocks: BlockLike[]
  busyRanges: BusyRange[]
  stepMinutes?: number
  now?: Date
}): SlotItem[] {
  const normalizedDate = normalizeBusinessDate(params.date)
  if (!normalizedDate) {
    return []
  }

  const dayKey = getDayKeyFromDate(normalizedDate)
  const openingWindow = getDayWindow(params.openingHours, dayKey)
  const barberWindow = getDayWindow(params.weeklySchedule, dayKey)

  if (
    !openingWindow?.enabled ||
    !barberWindow?.enabled ||
    !openingWindow.start ||
    !openingWindow.end ||
    !barberWindow.start ||
    !barberWindow.end ||
    !TIME_REGEX.test(openingWindow.start) ||
    !TIME_REGEX.test(openingWindow.end) ||
    !TIME_REGEX.test(barberWindow.start) ||
    !TIME_REGEX.test(barberWindow.end)
  ) {
    return []
  }

  const openingStart = parseTimeToMinutes(openingWindow.start)
  const openingEnd = parseTimeToMinutes(openingWindow.end)
  const barberStart = parseTimeToMinutes(barberWindow.start)
  const barberEnd = parseTimeToMinutes(barberWindow.end)

  const startLimit = Math.max(openingStart, barberStart)
  const endLimit = Math.min(openingEnd, barberEnd)
  const duration = params.serviceDuration
  const stepMinutes = params.stepMinutes ?? 30

  if (endLimit - startLimit < duration || duration <= 0 || stepMinutes <= 0) {
    return []
  }

  if (params.blocks.some((block) => block.allDay)) {
    return []
  }

  const now = params.now ?? new Date()
  const nowDate = getBusinessDateFromDate(now)
  const nowTimeMinutes = parseTimeToMinutes(getBusinessTimeFromDate(now))
  const slots: SlotItem[] = []

  for (
    let currentStart = startLimit;
    currentStart + duration <= endLimit;
    currentStart += stepMinutes
  ) {
    if (normalizedDate === nowDate && currentStart <= nowTimeMinutes) {
      continue
    }

    const currentEnd = currentStart + duration
    let blockedByManualBlock = false

    for (const block of params.blocks) {
      if (!block.startTime || !block.endTime) {
        continue
      }

      if (!TIME_REGEX.test(block.startTime) || !TIME_REGEX.test(block.endTime)) {
        continue
      }

      const blockStart = parseTimeToMinutes(block.startTime)
      const blockEnd = parseTimeToMinutes(block.endTime)
      if (currentStart < blockEnd && currentEnd > blockStart) {
        blockedByManualBlock = true
        break
      }
    }

    if (blockedByManualBlock) {
      continue
    }

    const startTime = minutesToTime(currentStart)
    const endTime = minutesToTime(currentEnd)
    const slotStart = toBusinessDateTime(normalizedDate, startTime)
    const slotEnd = toBusinessDateTime(normalizedDate, endTime)

    const blockedByAppointment = params.busyRanges.some((range) =>
      overlaps(slotStart, slotEnd, range.startAt, range.endAt)
    )

    if (blockedByAppointment) {
      continue
    }

    slots.push({
      time: startTime,
      startAt: slotStart,
      endAt: slotEnd,
    })
  }

  return slots
}
