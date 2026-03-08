<<<<<<< ours
<<<<<<< ours
﻿import { generateWeeklyInvoiceForBarbershop } from "@/lib/finance/generate-weekly-invoice"
=======
import { generateWeeklyInvoiceForBarbershop } from "@/lib/finance/generate-weekly-invoice"
>>>>>>> theirs
=======
import { generateWeeklyInvoiceForBarbershop } from "@/lib/finance/generate-weekly-invoice"
>>>>>>> theirs
import { markPastConfirmedAppointmentsAsCompleted } from "@/lib/finance/appointments"
import { requireOwnerFinanceContext } from "@/lib/finance/owner-context"
import { refreshBarbershopFinancialState } from "@/lib/finance/invoices"
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
    const result = await generateWeeklyInvoiceForBarbershop({
      barbershopId: context.barbershopId,
      week,
    })

    await refreshBarbershopFinancialState(context.barbershopId)

    return success(
      {
        created: result.created,
        invoice: result.invoice,
      },
      result.created ? 201 : 200
    )
  } catch (err) {
    return handleError(err)
  }
}
