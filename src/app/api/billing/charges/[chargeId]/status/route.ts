import { z } from "zod"
import { ChargeStatus } from "@/lib/billing/types"
import { prisma } from "@/lib/db/prisma"
import { refreshBarbershopFinancialState } from "@/lib/finance/invoices"
import { requireOwnerFinanceContext } from "@/lib/finance/owner-context"
import { AbacatePayError, getPixChargeStatus } from "@/lib/integrations/abacatepay"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"

const paramsSchema = z.object({
  chargeId: z.string().min(1, "chargeId inválido."),
})

function mapInvoiceStatusByCharge(chargeStatus: ChargeStatus, invoiceStatus: "OPEN" | "PAID" | "OVERDUE" | "VOID") {
  if (invoiceStatus === "PAID") return "PAID"
  if (chargeStatus === "PAID") return "PAID"
  return invoiceStatus
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chargeId: string }> }
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

    const chargeId = parsedParams.data.chargeId.trim()

    const invoice = await prisma.weeklyInvoice.findFirst({
      where: {
        barbershopId: context.barbershopId,
        abacateChargeId: chargeId,
      },
      select: {
        id: true,
        status: true,
        totalFeesCents: true,
        paidAt: true,
      },
    })

    if (!invoice) {
      return failure("NOT_FOUND", "Cobrança não encontrada para esta barbearia.", 404)
    }

    if (invoice.status === "PAID") {
      return success({
        invoiceId: invoice.id,
        chargeId,
        status: "PAID" as ChargeStatus,
        invoiceStatus: "PAID",
        paidAt: invoice.paidAt?.toISOString() ?? null,
        amountCents: invoice.totalFeesCents,
        expiresAt: null,
        pollingDelayMs: 3000,
      })
    }

    try {
      const charge = await getPixChargeStatus(chargeId)

      if (charge.status === "PAID") {
        const paidAt = charge.paidAt ? new Date(charge.paidAt) : new Date()

        const updated = await prisma.$transaction(async (tx) => {
          const updatedInvoice = await tx.weeklyInvoice.update({
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
              paidAt: true,
            },
          })

          await refreshBarbershopFinancialState(context.barbershopId, tx)
          return updatedInvoice
        })

        return success({
          invoiceId: updated.id,
          chargeId,
          status: "PAID" as ChargeStatus,
          invoiceStatus: "PAID",
          paidAt: updated.paidAt?.toISOString() ?? null,
          amountCents: charge.amountCents > 0 ? charge.amountCents : invoice.totalFeesCents,
          expiresAt: charge.expiresAt,
          pollingDelayMs: 3000,
        })
      }

      await prisma.weeklyInvoice.update({
        where: { id: invoice.id },
        data: {
          abacateChargeStatus: charge.rawStatus,
          abacateChargeExpiresAt: charge.expiresAt ? new Date(charge.expiresAt) : undefined,
        },
        select: { id: true },
      })

      return success({
        invoiceId: invoice.id,
        chargeId,
        status: charge.status,
        invoiceStatus: mapInvoiceStatusByCharge(charge.status, invoice.status),
        paidAt: null,
        amountCents: charge.amountCents > 0 ? charge.amountCents : invoice.totalFeesCents,
        expiresAt: charge.expiresAt,
        pollingDelayMs: 3000,
      })
    } catch (err) {
      if (err instanceof AbacatePayError) {
        if (err.status === 429) {
          console.error("[billing] charge status rate limited", {
            route: "GET /api/billing/charges/:chargeId/status",
            chargeId,
            message: err.message,
          })

          return success({
            invoiceId: invoice.id,
            chargeId,
            status: "PENDING" as ChargeStatus,
            invoiceStatus: invoice.status,
            paidAt: null,
            amountCents: invoice.totalFeesCents,
            expiresAt: null,
            pollingDelayMs: 5000,
            rateLimited: true,
          })
        }

        console.error("[billing] failed to check pix charge", {
          route: "GET /api/billing/charges/:chargeId/status",
          chargeId,
          errorCode: err.code,
          status: err.status,
          message: err.message,
        })

        return failure("ABACATEPAY_ERROR", "Falha ao consultar status da Cobrança PIX.", 502)
      }

      throw err
    }
  } catch (err) {
    return handleError(err)
  }
}
