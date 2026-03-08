import { z } from "zod"
import { ChargeStatus } from "@/lib/billing/types"
import { mapMercadoPagoStatus, MERCADOPAGO_PROVIDER, toAmountCents } from "@/lib/billing/mercadopago"
import { prisma } from "@/lib/db/prisma"
import { refreshBarbershopFinancialState } from "@/lib/finance/invoices"
import { requireOwnerFinanceContext } from "@/lib/finance/owner-context"
import { getMercadoPagoPayment, MercadoPagoError } from "@/lib/integrations/mercadopago"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"

const paramsSchema = z.object({
  invoiceId: z.string().uuid("invoiceId invalido."),
})

async function handleStatusCheck(
  req: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
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
        id: parsedParams.data.invoiceId,
        barbershopId: context.barbershopId,
      },
      select: {
        id: true,
        status: true,
        totalFeesCents: true,
        paidAt: true,
        paymentProvider: true,
        providerPaymentId: true,
      },
    })

    if (!invoice) {
      return failure("NOT_FOUND", "Fatura nao encontrada para esta barbearia.", 404)
    }

    if (invoice.status === "PAID") {
      return success({
        invoiceId: invoice.id,
        status: "PAID" as ChargeStatus,
        paidAt: invoice.paidAt?.toISOString() ?? null,
        expiresAt: null,
      })
    }

    if (!invoice.providerPaymentId || invoice.paymentProvider !== MERCADOPAGO_PROVIDER) {
      return failure("CHARGE_NOT_FOUND", "Esta fatura ainda nao possui cobranca PIX ativa.", 409)
    }

    try {
      const payment = await getMercadoPagoPayment(invoice.providerPaymentId)
      const expiresAt = payment.expiresAt ? new Date(payment.expiresAt) : null
      const paymentStatus = mapMercadoPagoStatus(payment.status, expiresAt)
      const amountCents = toAmountCents(payment.amount) ?? invoice.totalFeesCents

      if (paymentStatus === "PAID") {
        const paidAt = new Date()

        const updated = await prisma.$transaction(async (tx) => {
          const updatedInvoice = await tx.weeklyInvoice.update({
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
              paidAt: true,
            },
          })

          await refreshBarbershopFinancialState(context.barbershopId, tx)
          return updatedInvoice
        })

        return success({
          invoiceId: updated.id,
          status: "PAID" as ChargeStatus,
          paidAt: updated.paidAt?.toISOString() ?? null,
          expiresAt: payment.expiresAt,
        })
      }

      await prisma.weeklyInvoice.update({
        where: { id: invoice.id },
        data: {
          paymentProvider: MERCADOPAGO_PROVIDER,
          providerStatus: payment.status,
          providerStatusDetail: payment.statusDetail,
          providerAmountCents: amountCents,
          providerExpiresAt: expiresAt,
          providerTicketUrl: payment.ticketUrl,
          providerExternalReference: payment.externalReference ?? invoice.id,
          providerPixCode: payment.qrCode,
          providerQrCodeBase64: payment.qrCodeBase64,
        },
        select: { id: true },
      })

      return success({
        invoiceId: invoice.id,
        status: paymentStatus,
        paidAt: null,
        expiresAt: payment.expiresAt,
      })
    } catch (err) {
      if (err instanceof MercadoPagoError) {
        if (err.status === 429) {
          console.error("[billing] charge status rate limited", {
            route: "POST /api/billing/invoices/:invoiceId/pay/status",
            invoiceId: invoice.id,
            message: err.message,
          })

          return success({
            invoiceId: invoice.id,
            status: "PENDING" as ChargeStatus,
            paidAt: null,
            expiresAt: null,
            rateLimited: true,
          })
        }

        console.error("[billing] failed to check pix charge", {
          route: "POST /api/billing/invoices/:invoiceId/pay/status",
          invoiceId: invoice.id,
          errorCode: err.code,
          status: err.status,
          message: err.message,
        })

        return failure("MERCADOPAGO_ERROR", "Falha ao consultar status da cobranca PIX.", 502)
      }

      throw err
    }
  } catch (err) {
    return handleError(err)
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ invoiceId: string }> }
) {
  return handleStatusCheck(req, context)
}

export async function GET(
  req: Request,
  context: { params: Promise<{ invoiceId: string }> }
) {
  return handleStatusCheck(req, context)
}
