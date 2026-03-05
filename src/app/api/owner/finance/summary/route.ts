import { prisma } from "@/lib/db/prisma"
import { requireOwnerFinanceContext } from "@/lib/finance/owner-context"
import { refreshBarbershopFinancialState } from "@/lib/finance/invoices"
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

    await refreshBarbershopFinancialState(context.barbershopId)

    const url = new URL(req.url)
    const { month, start, end } = resolveMonthRange(url.searchParams.get("month"))

    const [appointmentsCount, aggregate, barbershop] = await Promise.all([
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
      prisma.barbershop.findUnique({
        where: { id: context.barbershopId },
        select: {
          financialStatus: true,
          blockedReason: true,
          blockedAt: true,
        },
      }),
    ])

    return success({
      month,
      monthlyAppointmentsCount: appointmentsCount,
      monthlyServiceAmountCents: aggregate._sum.servicePriceCents ?? 0,
      monthlyTotalAmountCents: aggregate._sum.totalPriceCents ?? 0,
      financialStatus: barbershop?.financialStatus ?? "ACTIVE",
      blockedReason: barbershop?.blockedReason ?? null,
      blockedAt: barbershop?.blockedAt ?? null,
    })
  } catch (err) {
    return handleError(err)
  }
}

