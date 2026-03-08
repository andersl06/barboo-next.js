import { z } from "zod"
import { mapMercadoPagoStatus, MERCADOPAGO_PROVIDER, toAmountCents } from "@/lib/billing/mercadopago"
import { prisma } from "@/lib/db/prisma"
import { requireOwnerFinanceContext } from "@/lib/finance/owner-context"
import { refreshBarbershopFinancialState } from "@/lib/finance/invoices"
import { getMercadoPagoPayment, MercadoPagoError } from "@/lib/integrations/mercadopago"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"

const paramsSchema = z.object({
  id: z.string().uuid("id invalido."),
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
        "Erro de Validacao",
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
        paymentProvider: true,
        providerPaymentId: true,
      },
    })

    if (!invoice) {
      return failure("NOT_FOUND", "Fatura nao encontrada.", 404)
    }

    if (invoice.status === "PAID") {
      return failure("INVOICE_ALREADY_PAID", "Esta fatura Ja esta paga.", 409)
    }

    if (!invoice.providerPaymentId || invoice.paymentProvider !== MERCADOPAGO_PROVIDER) {
      return failure("CHARGE_NOT_FOUND", "Esta fatura nao possui cobranca PIX vinculada.", 409)
    }

    const payment = await getMercadoPagoPayment(invoice.providerPaymentId)
    const expiresAt = payment.expiresAt ? new Date(payment.expiresAt) : null
    const paymentStatus = mapMercadoPagoStatus(payment.status, expiresAt)

    if (paymentStatus !== "PAID") {
      return failure("PAYMENT_NOT_CONFIRMED", "Pagamento ainda nao confirmado no Mercado Pago.", 409)
    }

    const paidAt = new Date()
    const amountCents = toAmountCents(payment.amount) ?? invoice.totalFeesCents

    const updated = await prisma.weeklyInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "PAID",
        paidAt,
        paymentProvider: MERCADOPAGO_PROVIDER,
        providerStatus: payment.status,
        providerStatusDetail: payment.statusDetail,
        providerAmountCents: amountCents,
        providerExpiresAt: expiresAt,
        providerTicketUrl: payment.ticketUrl,
        providerExternalReference: payment.externalReference ?? invoice.id,
        providerPixCode: payment.qrCode,
        providerQrCodeBase64: payment.qrCodeBase64,
        providerPaidAt: paidAt,
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
    if (err instanceof MercadoPagoError) {
      console.error("[finance] mark-paid check failed", {
        route: "POST /api/owner/finance/invoices/:id/mark-paid",
        errorCode: err.code,
        status: err.status,
        message: err.message,
      })

      return failure("MERCADOPAGO_ERROR", "Falha ao validar pagamento no Mercado Pago.", 502)
    }

    return handleError(err)
  }
}
