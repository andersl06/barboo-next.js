import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { requireOwnerFinanceContext } from "@/lib/finance/owner-context"
import { refreshBarbershopFinancialState } from "@/lib/finance/invoices"
import { AbacatePayError, getPixChargeStatus } from "@/lib/integrations/abacatepay"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"

const paramsSchema = z.object({
  id: z.string().uuid("id inválido."),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireOwnerFinanceContext(req)
    if ("error" in context) {
      return failure(context.code, context.message, context.status)
    }

    const parsedParams = paramsSchema.safeParse(await params)
    if (!parsedParams.success) {
      return failure(
        "VALIDATION_ERROR",
        "Erro de Validação",
        400,
        parsedParams.error.issues.map((issue) => ({
          field:
            typeof issue.path[0] === "string" || typeof issue.path[0] === "number"
              ? issue.path[0]
              : undefined,
          message: issue.message,
        }))
      )
    }

    const invoice = await prisma.weeklyInvoice.findFirst({
      where: {
        id: parsedParams.data.id,
        barbershopId: context.barbershopId,
      },
      select: {
        id: true,
        status: true,
        totalFeesCents: true,
        abacateChargeId: true,
      },
    })

    if (!invoice) {
      return failure("NOT_FOUND", "Fatura não encontrada.", 404)
    }

    if (invoice.status === "PAID") {
      return failure("INVOICE_ALREADY_PAID", "Esta fatura Já esta paga.", 409)
    }

    if (!invoice.abacateChargeId) {
      return failure("CHARGE_NOT_FOUND", "Esta fatura não possui Cobrança PIX vinculada.", 409)
    }

    const charge = await getPixChargeStatus(invoice.abacateChargeId)
    if (charge.status !== "PAID") {
      return failure("PAYMENT_NOT_CONFIRMED", "Pagamento ainda não confirmado na AbacatePay.", 409)
    }

    const paidAt = charge.paidAt ? new Date(charge.paidAt) : new Date()
    const updated = await prisma.weeklyInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "PAID",
        paidAt,
        abacatePaidAt: paidAt,
        abacatePaidAmountCents: charge.amountCents > 0 ? charge.amountCents : invoice.totalFeesCents,
        abacateChargeStatus: charge.rawStatus,
      },
      select: {
        id: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        dueAt: true,
        paidAt: true,
        totalAppointments: true,
        totalFeesCents: true,
      },
    })

    const financialState = await refreshBarbershopFinancialState(context.barbershopId)

    return success({
      invoice: updated,
      financialStatus: financialState.financialStatus,
    })
  } catch (err) {
    if (err instanceof AbacatePayError) {
      console.error("[finance] mark-paid check failed", {
        route: "POST /api/owner/finance/invoices/:id/mark-paid",
        errorCode: err.code,
        status: err.status,
        message: err.message,
      })

      return failure("ABACATEPAY_ERROR", "Falha ao validar pagamento na AbacatePay.", 502)
    }

    return handleError(err)
  }
}
