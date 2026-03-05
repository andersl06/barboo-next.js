import { z } from "zod"
import { InvoiceStatus } from "@/lib/billing/types"
import { prisma } from "@/lib/db/prisma"
import { requireOwnerFinanceContext } from "@/lib/finance/owner-context"
import { AbacatePayError, createPixCharge } from "@/lib/integrations/abacatepay"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"

const paramsSchema = z.object({
  invoiceId: z.string().uuid("invoiceId invalido."),
})

const CHARGE_EXPIRES_IN_SECONDS = 5 * 60

const PAYABLE_STATUSES: InvoiceStatus[] = ["OPEN", "OVERDUE"]

function mapStoredChargeStatus(rawStatus: string | null, expiresAt: Date | null) {
  const normalized = (rawStatus ?? "").trim().toUpperCase()

  if (["PAID", "APPROVED", "COMPLETED", "SUCCESS"].includes(normalized)) {
    return "PAID" as const
  }

  if (["EXPIRED", "CANCELED", "CANCELLED", "FAILED", "VOID"].includes(normalized)) {
    return "EXPIRED" as const
  }

  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return "EXPIRED" as const
  }

  return "PENDING" as const
}

function canReuseStoredCharge(invoice: {
  status: InvoiceStatus
  abacateChargeId: string | null
  abacateChargeExpiresAt: Date | null
  abacateQrCodeCopyPaste: string | null
}) {
  if (!PAYABLE_STATUSES.includes(invoice.status)) return false
  if (!invoice.abacateChargeId) return false
  if (!invoice.abacateChargeExpiresAt) return false
  if (!invoice.abacateQrCodeCopyPaste) return false
  return invoice.abacateChargeExpiresAt.getTime() > Date.now()
}

function toIsoWeekLabel(date: Date) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
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
        "Erro de validacao",
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
        abacateChargeId: true,
        abacateChargeStatus: true,
        abacateChargeExpiresAt: true,
        abacateQrCodeImageUrl: true,
        abacateQrCodeCopyPaste: true,
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
      return failure("INVOICE_ALREADY_PAID", "Esta fatura ja esta paga.", 409)
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
        chargeId: invoice.abacateChargeId,
        qrCodeImageUrl: invoice.abacateQrCodeImageUrl,
        qrCodeCopyPaste: invoice.abacateQrCodeCopyPaste,
        expiresAt: invoice.abacateChargeExpiresAt?.toISOString() ?? null,
        amountCents: invoice.totalFeesCents,
        status: mapStoredChargeStatus(invoice.abacateChargeStatus, invoice.abacateChargeExpiresAt),
        reused: true,
      })
    }

    const weekLabel = toIsoWeekLabel(invoice.periodStart)
    const description = `Fatura semanal - ${invoice.barbershop.name} - ${weekLabel}`

    const charge = await createPixCharge({
      amountCents: invoice.totalFeesCents,
      description,
      expiresInSeconds: CHARGE_EXPIRES_IN_SECONDS,
      externalId: invoice.id,
    })

    await prisma.weeklyInvoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        abacateChargeId: charge.chargeId,
        abacateChargeStatus: charge.rawStatus,
        abacateChargeCreatedAt: charge.createdAt ? new Date(charge.createdAt) : new Date(),
        abacateChargeExpiresAt: charge.expiresAt ? new Date(charge.expiresAt) : null,
        abacateQrCodeImageUrl: charge.qrCodeImageUrl,
        abacateQrCodeCopyPaste: charge.qrCodeCopyPaste,
      },
      select: {
        id: true,
      },
    })

    return success({
      invoiceId: invoice.id,
      chargeId: charge.chargeId,
      qrCodeImageUrl: charge.qrCodeImageUrl,
      qrCodeCopyPaste: charge.qrCodeCopyPaste,
      expiresAt: charge.expiresAt,
      amountCents: invoice.totalFeesCents,
      status: charge.status,
      reused: false,
    })
  } catch (err) {
    if (err instanceof AbacatePayError) {
      console.error("[billing] failed to create pix charge", {
        route: "POST /api/billing/invoices/:invoiceId/pay",
        errorCode: err.code,
        status: err.status,
        message: err.message,
      })

      if (err.status === 429) {
        return failure("ABACATEPAY_RATE_LIMIT", "Limite temporario de cobrancas PIX atingido. Tente novamente.", 429)
      }

      const statusCode = typeof err.status === "number" && err.status >= 400 ? err.status : 502
      return failure("ABACATEPAY_ERROR", "Falha ao criar cobranca PIX no momento.", statusCode)
    }

    return handleError(err)
  }
}
