import { prisma } from "@/lib/db/prisma"
import { markPastConfirmedAppointmentsAsCompleted } from "@/lib/finance/appointments"
import { requireOwnerFinanceContext } from "@/lib/finance/owner-context"
import { getWeeklyPeriod, refreshBarbershopFinancialState, resolveInvoiceStatusTotals } from "@/lib/finance/invoices"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"

const MONTH_REGEX = /^\d{4}-\d{2}$/
const BUSINESS_OFFSET = "-03:00"

function getBusinessMonthLabel() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date()).slice(0, 7)
}

function resolveMonthRange(monthValue: string | null) {
  const month = monthValue && MONTH_REGEX.test(monthValue) ? monthValue : getBusinessMonthLabel()
  const [year, monthNum] = month.split("-").map((value) => Number(value))

  const start = new Date(`${month}-01T00:00:00.000${BUSINESS_OFFSET}`)
  const nextMonthYear = monthNum === 12 ? year + 1 : year
  const nextMonth = monthNum === 12 ? 1 : monthNum + 1
  const end = new Date(
    `${String(nextMonthYear)}-${String(nextMonth).padStart(2, "0")}-01T00:00:00.000${BUSINESS_OFFSET}`
  )

  return { month, start, end }
}

export async function GET(req: Request) {
  try {
    const context = await requireOwnerFinanceContext(req)
    if ("error" in context) {
      return failure(context.code, context.message, context.status)
    }

    await markPastConfirmedAppointmentsAsCompleted(context.barbershopId)
    await refreshBarbershopFinancialState(context.barbershopId)

    const url = new URL(req.url)
    const { month, start, end } = resolveMonthRange(url.searchParams.get("month"))
    const week = getWeeklyPeriod()

    const [
      appointmentsCount,
      aggregate,
      weeklyAppointmentsCount,
      weeklyAggregate,
      barbershop,
      invoiceStatusTotals,
    ] = await Promise.all([
      prisma.barbershopAppointment.count({
        where: {
          barbershopId: context.barbershopId,
          status: {
            in: ["CONFIRMED", "COMPLETED"],
          },
          startAt: {
            gte: start,
            lt: end,
          },
        },
      }),
      prisma.barbershopAppointment.aggregate({
        where: {
          barbershopId: context.barbershopId,
          status: {
            in: ["CONFIRMED", "COMPLETED"],
          },
          startAt: {
            gte: start,
            lt: end,
          },
        },
        _sum: {
          servicePriceCents: true,
          totalPriceCents: true,
        },
      }),
      prisma.barbershopAppointment.count({
        where: {
          barbershopId: context.barbershopId,
          status: {
            in: ["CONFIRMED", "COMPLETED"],
          },
          startAt: {
            gte: week.periodStartAt,
            lt: week.periodEndExclusiveAt,
          },
        },
      }),
      prisma.barbershopAppointment.aggregate({
        where: {
          barbershopId: context.barbershopId,
          status: {
            in: ["CONFIRMED", "COMPLETED"],
          },
          startAt: {
            gte: week.periodStartAt,
            lt: week.periodEndExclusiveAt,
          },
        },
        _sum: {
          servicePriceCents: true,
          serviceFeeCents: true,
          totalPriceCents: true,
        },
      }),
      prisma.barbershop.findUnique({
        where: { id: context.barbershopId },
        select: {
          financialStatus: true,
          blockedReason: true,
          blockedAt: true,
        },
      }),
      resolveInvoiceStatusTotals(context.barbershopId),
    ])

    return success({
      month,
      monthlyAppointmentsCount: appointmentsCount,
      monthlyServiceAmountCents: aggregate._sum.servicePriceCents ?? 0,
      monthlyTotalAmountCents: aggregate._sum.totalPriceCents ?? 0,
      weeklyAppointmentsCount,
      weeklyServiceAmountCents: weeklyAggregate._sum.servicePriceCents ?? 0,
      weeklyFeeAmountCents: weeklyAggregate._sum.serviceFeeCents ?? 0,
      weeklyTotalAmountCents: weeklyAggregate._sum.totalPriceCents ?? 0,
      invoiceStatusTotals,
      financialStatus: barbershop?.financialStatus ?? "ACTIVE",
      blockedReason: barbershop?.blockedReason ?? null,
      blockedAt: barbershop?.blockedAt ?? null,
    })
  } catch (err) {
    return handleError(err)
  }
}
