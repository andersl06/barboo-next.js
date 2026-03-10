import { z } from "zod"
import { InvoiceStatus } from "@/lib/billing/types"
import { mapMercadoPagoStatus, MERCADOPAGO_PROVIDER, normalizeQrCodeImage, toAmountCents } from "@/lib/billing/mercadopago"
import { prisma } from "@/lib/db/prisma"
import { refreshBarbershopFinancialState } from "@/lib/finance/invoices"
import { requireOwnerFinanceContext } from "@/lib/finance/owner-context"
import { createMercadoPagoPixPayment, MercadoPagoError } from "@/lib/integrations/mercadopago"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import crypto from "crypto"

const paramsSchema = z.object({
  invoiceId: z.string().uuid("invoiceId invalido."),
})

const CHARGE_EXPIRES_IN_SECONDS = 5 * 60
const PAYMENT_DESCRIPTION_MAX_LENGTH = 60

const PAYABLE_STATUSES: InvoiceStatus[] = ["OPEN", "OVERDUE"]

function mapStoredChargeStatus(rawStatus: string | null, expiresAt: Date | null) {
  return mapMercadoPagoStatus(rawStatus, expiresAt)
}

function canReuseStoredCharge(invoice: {
  status: InvoiceStatus
  paymentProvider: string | null
  providerPaymentId: string | null
  providerExpiresAt: Date | null
  providerPixCode: string | null
  providerIdempotencyKey: string | null
}) {
  if (!PAYABLE_STATUSES.includes(invoice.status)) return false
  if (invoice.paymentProvider !== MERCADOPAGO_PROVIDER) return false
  if (!invoice.providerPaymentId) return false
  if (!invoice.providerExpiresAt) return false
  if (!invoice.providerPixCode) return false
  return invoice.providerExpiresAt.getTime() > Date.now()
}

function toIsoWeekLabel(date: Date) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}

function buildPixDescription(barbershopName: string, weekLabel: string) {
  const base = `Fatura semanal ${barbershopName} ${weekLabel}`
  const normalized = base.replace(/\s+/g, " ").trim()
  return normalized.slice(0, PAYMENT_DESCRIPTION_MAX_LENGTH)
}

export async function POST(
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
        periodStart: true,
        periodEnd: true,
        paidAt: true,
        paymentProvider: true,
        providerPaymentId: true,
        providerStatus: true,
        providerExpiresAt: true,
        providerQrCodeBase64: true,
        providerPixCode: true,
        providerTicketUrl: true,
        providerIdempotencyKey: true,
        barbershop: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!invoice) {
      return failure("NOT_FOUND", "Fatura nao encontrada.", 404)
    }

    if (invoice.status === "PAID") {
      return failure("INVOICE_ALREADY_PAID", "Esta fatura Ja esta paga.", 409)
    }

    if (!PAYABLE_STATUSES.includes(invoice.status)) {
      return failure("INVOICE_NOT_PAYABLE", "Esta fatura nao esta disponivel para pagamento.", 409)
    }

    if (invoice.totalFeesCents <= 0) {
      return failure("INVOICE_AMOUNT_INVALID", "Fatura sem valor valido para cobranca.", 409)
    }

    if (canReuseStoredCharge(invoice)) {
      return success({
        invoiceId: invoice.id,
        qrCodeImageUrl: normalizeQrCodeImage(invoice.providerQrCodeBase64),
        qrCodeCopyPaste: invoice.providerPixCode ?? "",
        pixCode: invoice.providerPixCode ?? "",
        qrCodeBase64: invoice.providerQrCodeBase64,
        ticketUrl: invoice.providerTicketUrl ?? null,
        expiresAt: invoice.providerExpiresAt?.toISOString() ?? null,
        amount: invoice.totalFeesCents / 100,
        amountCents: invoice.totalFeesCents,
        status: mapStoredChargeStatus(invoice.providerStatus, invoice.providerExpiresAt),
        reused: true,
      })
    }

    const owner = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { email: true },
    })

    if (!owner?.email) {
      return failure("OWNER_EMAIL_NOT_FOUND", "Nao foi possivel encontrar o e-mail do owner.", 409)
    }

    const weekLabel = toIsoWeekLabel(invoice.periodStart)
    const description = buildPixDescription(invoice.barbershop.name, weekLabel)

    let idempotencyKey = invoice.providerIdempotencyKey
    const shouldRefreshIdempotencyKey = !idempotencyKey || Boolean(invoice.providerPaymentId)
    if (shouldRefreshIdempotencyKey) {
      idempotencyKey = `inv-${invoice.id}-${crypto.randomUUID()}`
      await prisma.weeklyInvoice.update({
        where: { id: invoice.id },
        data: {
          providerIdempotencyKey: idempotencyKey,
        },
        select: { id: true },
      })
    }

    const payment = await createMercadoPagoPixPayment({
      amountCents: invoice.totalFeesCents,
      description,
      externalReference: invoice.id,
      payerEmail: owner.email,
      expiresInSeconds: CHARGE_EXPIRES_IN_SECONDS,
      idempotencyKey,
    })

    if (!payment.qrCode) {
      throw new MercadoPagoError("Resposta do Mercado Pago sem codigo PIX.", {
        code: "PARSE_ERROR",
        status: 502,
        details: payment,
      })
    }

    const expiresAt = payment.expiresAt ? new Date(payment.expiresAt) : null
    const amountCents = toAmountCents(payment.amount) ?? invoice.totalFeesCents
    const paymentStatus = mapMercadoPagoStatus(payment.status, expiresAt)
    const paidAt = paymentStatus === "PAID" ? new Date() : null

    await prisma.$transaction(async (tx) => {
      await tx.weeklyInvoice.update({
        where: {
          id: invoice.id,
        },
        data: {
          status: paymentStatus === "PAID" ? "PAID" : invoice.status,
          paidAt: paymentStatus === "PAID" ? paidAt : invoice.paidAt,
          paymentProvider: MERCADOPAGO_PROVIDER,
          providerPaymentId: payment.id,
          providerStatus: payment.status,
          providerStatusDetail: payment.statusDetail,
          providerAmountCents: amountCents,
          providerExpiresAt: expiresAt,
          providerPixCode: payment.qrCode,
          providerQrCodeBase64: payment.qrCodeBase64,
          providerTicketUrl: payment.ticketUrl,
          providerExternalReference: payment.externalReference ?? invoice.id,
          providerIdempotencyKey: idempotencyKey,
          providerPaidAt: paidAt,
        },
        select: {
          id: true,
        },
      })

      if (paymentStatus === "PAID") {
        await refreshBarbershopFinancialState(context.barbershopId, tx)
      }
    })

    return success({
      invoiceId: invoice.id,
      qrCodeImageUrl: normalizeQrCodeImage(payment.qrCodeBase64),
      qrCodeCopyPaste: payment.qrCode,
      pixCode: payment.qrCode,
      qrCodeBase64: payment.qrCodeBase64,
      ticketUrl: payment.ticketUrl,
      expiresAt: payment.expiresAt,
      amount: payment.amount,
      amountCents: invoice.totalFeesCents,
      status: paymentStatus,
      reused: false,
    })
  } catch (err) {
    if (err instanceof MercadoPagoError) {
      console.error("[billing] failed to create pix charge", {
        route: "POST /api/billing/invoices/:invoiceId/pay",
        errorCode: err.code,
        status: err.status,
        message: err.message,
        details: err.details,
      })

      if (err.status === 429) {
        return failure("MERCADOPAGO_RATE_LIMIT", "Limite temporario de cobrancas PIX atingido. Tente novamente.", 429)
      }

      if (err.status === 400 || err.status === 422) {
        return failure("MERCADOPAGO_VALIDATION_ERROR", err.message, err.status)
      }

      const statusCode = typeof err.status === "number" && err.status >= 400 ? err.status : 502
      return failure("MERCADOPAGO_ERROR", "Falha ao criar cobranca PIX no momento.", statusCode)
    }

    return handleError(err)
  }
}
