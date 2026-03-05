import type { FinanceInvoiceStatus, Prisma, PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"

const BUSINESS_TIMEZONE = "America/Sao_Paulo"
const FINANCIAL_BLOCK_REASON = "Financeiro: pendencia em fatura semanal vencida."

function toBusinessDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value)
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map((value) => Number(value))
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  probe.setUTCDate(probe.getUTCDate() + days)

  const yyyy = probe.getUTCFullYear()
  const mm = String(probe.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(probe.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export function parseBusinessDateToUtc(date: string) {
  return new Date(`${date}T00:00:00.000-03:00`)
}

function getWeekdayIndex(date: string) {
  const [year, month, day] = date.split("-").map((value) => Number(value))
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay()
}

export function getWeeklyPeriod(weekDate?: string) {
  const normalizedDate = weekDate && /^\d{4}-\d{2}-\d{2}$/.test(weekDate)
    ? weekDate
    : toBusinessDate(new Date())

  const weekday = getWeekdayIndex(normalizedDate)
  const daysSinceMonday = (weekday + 6) % 7

  const periodStartDate = addDays(normalizedDate, -daysSinceMonday)
  const periodEndDate = addDays(periodStartDate, 6)
  const periodEndExclusiveDate = addDays(periodStartDate, 7)

  const periodStartAt = parseBusinessDateToUtc(periodStartDate)
  const periodEndExclusiveAt = parseBusinessDateToUtc(periodEndExclusiveDate)
  const dueAt = new Date(periodEndExclusiveAt.getTime() + 3 * 24 * 60 * 60 * 1000 - 1)

  return {
    periodStartDate,
    periodEndDate,
    periodStartAt,
    periodEndExclusiveAt,
    dueAt,
  }
}

export function formatPeriodLabel(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: BUSINESS_TIMEZONE,
  })
  return `${formatter.format(start)} - ${formatter.format(end)}`
}

export async function refreshBarbershopFinancialState(
  barbershopId: string,
  client?: PrismaClient | Prisma.TransactionClient
) {
  const db = client ?? prisma
  const now = new Date()

  await db.weeklyInvoice.updateMany({
    where: {
      barbershopId,
      status: "OPEN",
      dueAt: {
        lt: now,
      },
    },
    data: {
      status: "OVERDUE",
    },
  })

  const overdueCount = await db.weeklyInvoice.count({
    where: {
      barbershopId,
      status: "OVERDUE",
    },
  })

  if (overdueCount > 0) {
    await db.barbershop.update({
      where: { id: barbershopId },
      data: {
        financialStatus: "BLOCKED",
        blockedReason: FINANCIAL_BLOCK_REASON,
        blockedAt: now,
      },
      select: { id: true },
    })
    return { financialStatus: "BLOCKED" as const }
  }

  await db.barbershop.updateMany({
    where: {
      id: barbershopId,
      financialStatus: "BLOCKED",
      blockedReason: FINANCIAL_BLOCK_REASON,
    },
    data: {
      financialStatus: "ACTIVE",
      blockedReason: null,
      blockedAt: null,
    },
  })

  return { financialStatus: "ACTIVE" as const }
}

export async function resolveInvoiceStatusTotals(barbershopId: string, client?: PrismaClient) {
  const db = client ?? prisma

  const grouped = await db.weeklyInvoice.groupBy({
    by: ["status"],
    where: {
      barbershopId,
    },
    _count: {
      _all: true,
    },
  })

  const totals: Record<FinanceInvoiceStatus, number> = {
    OPEN: 0,
    PAID: 0,
    OVERDUE: 0,
    VOID: 0,
  }

  for (const item of grouped) {
    totals[item.status] = item._count._all
  }

  return totals
}
