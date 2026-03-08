import { prisma } from "@/lib/db/prisma"
import { markPastConfirmedAppointmentsAsCompleted } from "@/lib/finance/appointments"
import { generateWeeklyInvoiceForBarbershop } from "@/lib/finance/generate-weekly-invoice"
import { requireOwnerFinanceContext } from "@/lib/finance/owner-context"
import { addBusinessDays, getCurrentBusinessDate, refreshBarbershopFinancialState } from "@/lib/finance/invoices"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"

export async function GET(req: Request) {
  try {
    const context = await requireOwnerFinanceContext(req)
    if ("error" in context) {
      return failure(context.code, context.message, context.status)
    }

    await markPastConfirmedAppointmentsAsCompleted(context.barbershopId)
<<<<<<< ours
<<<<<<< ours
    await generateWeeklyInvoiceForBarbershop({
      barbershopId: context.barbershopId,
=======
=======
>>>>>>> theirs
    const previousWeekReferenceDate = addBusinessDays(getCurrentBusinessDate(), -7)
    await generateWeeklyInvoiceForBarbershop({
      barbershopId: context.barbershopId,
      week: previousWeekReferenceDate,
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
    })
    await refreshBarbershopFinancialState(context.barbershopId)

    const [invoices, barbershop] = await Promise.all([
      prisma.weeklyInvoice.findMany({
        where: {
          barbershopId: context.barbershopId,
        },
        orderBy: [
          { periodStart: "desc" },
          { createdAt: "desc" },
        ],
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          dueAt: true,
          status: true,
          totalAppointments: true,
          totalFeesCents: true,
          paidAt: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          items: {
            orderBy: {
              appointment: {
                startAt: "asc",
              },
            },
            select: {
              appointmentId: true,
              appointment: {
                select: {
                  id: true,
                  startAt: true,
                  status: true,
                  servicePriceCents: true,
                  serviceFeeCents: true,
                  totalPriceCents: true,
                  service: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                  barberUser: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                  clientUser: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
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
      financialStatus: barbershop?.financialStatus ?? "ACTIVE",
      blockedReason: barbershop?.blockedReason ?? null,
      blockedAt: barbershop?.blockedAt ?? null,
      count: invoices.length,
      items: invoices,
    })
  } catch (err) {
    return handleError(err)
  }
}
