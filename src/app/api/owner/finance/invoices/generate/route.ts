import { prisma } from "@/lib/db/prisma"
import { markPastConfirmedAppointmentsAsCompleted } from "@/lib/finance/appointments"
import { requireOwnerFinanceContext } from "@/lib/finance/owner-context"
import { getWeeklyPeriod, parseBusinessDateToUtc, refreshBarbershopFinancialState } from "@/lib/finance/invoices"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"

export async function POST(req: Request) {
  try {
    const context = await requireOwnerFinanceContext(req)
    if ("error" in context) {
      return failure(context.code, context.message, context.status)
    }

    await markPastConfirmedAppointmentsAsCompleted(context.barbershopId)
    await refreshBarbershopFinancialState(context.barbershopId)

    const url = new URL(req.url)
    const week = url.searchParams.get("week") ?? undefined
    const period = getWeeklyPeriod(week)

    const existing = await prisma.weeklyInvoice.findUnique({
      where: {
        barbershopId_periodStart_periodEnd: {
          barbershopId: context.barbershopId,
          periodStart: parseBusinessDateToUtc(period.periodStartDate),
          periodEnd: parseBusinessDateToUtc(period.periodEndDate),
        },
      },
      select: {
        id: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        dueAt: true,
        totalAppointments: true,
        totalFeesCents: true,
      },
    })

    if (existing) {
      return success({
        created: false,
        invoice: existing,
      })
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const appointments = await tx.barbershopAppointment.findMany({
        where: {
          barbershopId: context.barbershopId,
          status: {
            in: ["CONFIRMED", "COMPLETED"],
          },
          startAt: {
            gte: period.periodStartAt,
            lt: period.periodEndExclusiveAt,
          },
          weeklyInvoiceItems: {
            none: {},
          },
        },
        select: {
          id: true,
          serviceFeeCents: true,
        },
        orderBy: {
          startAt: "asc",
        },
      })

      const totalFeesCents = appointments.reduce((sum, item) => sum + item.serviceFeeCents, 0)

      const createdInvoice = await tx.weeklyInvoice.create({
        data: {
          barbershopId: context.barbershopId,
          periodStart: parseBusinessDateToUtc(period.periodStartDate),
          periodEnd: parseBusinessDateToUtc(period.periodEndDate),
          dueAt: period.dueAt,
          status: "OPEN",
          totalAppointments: appointments.length,
          totalFeesCents,
          items: {
            createMany: {
              data: appointments.map((item) => ({
                appointmentId: item.id,
              })),
            },
          },
        },
        select: {
          id: true,
          status: true,
          periodStart: true,
          periodEnd: true,
          dueAt: true,
          totalAppointments: true,
          totalFeesCents: true,
        },
      })

      return createdInvoice
    })

    await refreshBarbershopFinancialState(context.barbershopId)

    return success(
      {
        created: true,
        invoice,
      },
      201
    )
  } catch (err) {
    return handleError(err)
  }
}
