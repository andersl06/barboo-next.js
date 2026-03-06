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

    const result = await markPastConfirmedAppointmentsAsCompleted(context.barbershopId)
    await refreshBarbershopFinancialState(context.barbershopId)

    return success({
      updatedCount: result.updatedCount,
    })
  } catch (err) {
    return handleError(err)
  }
}

