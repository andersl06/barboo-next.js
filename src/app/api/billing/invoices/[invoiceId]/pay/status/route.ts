import { z } from "zod"
import { ChargeStatus } from "@/lib/billing/types"
import { prisma } from "@/lib/db/prisma"
import { refreshBarbershopFinancialState } from "@/lib/finance/invoices"
import { requireOwnerFinanceContext } from "@/lib/finance/owner-context"
import { AbacatePayError, getPixChargeStatus } from "@/lib/integrations/abacatepay"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"

const paramsSchema = z.object({
  invoiceId: z.string().uuid("invoiceId inválido."),
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
        id: parsedParams.data.invoiceId,
        barbershopId: context.barbershopId,
      },
      select: {
        id: true,
        status: true,
        totalFeesCents: true,
        paidAt: true,
        abacateChargeId: true,
      },
    })

    if (!invoice) {
      return failure("NOT_FOUND", "Fatura não encontrada para esta barbearia.", 404)
    }

    if (!invoice.abacateChargeId) {
      return failure("CHARGE_NOT_FOUND", "Esta fatura ainda não possui Cobrança PIX ativa.", 409)
    }

    if (invoice.status === "PAID") {
      return success({
        invoiceId: invoice.id,
        status: "PAID" as ChargeStatus,
        paidAt: invoice.paidAt?.toISOString() ?? null,
        expiresAt: null,
      })
    }

    try {
      const charge = await getPixChargeStatus(invoice.abacateChargeId)

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
          status: "PAID" as ChargeStatus,
          paidAt: updated.paidAt?.toISOString() ?? null,
          expiresAt: charge.expiresAt,
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
        status: charge.status,
        paidAt: null,
        expiresAt: charge.expiresAt,
      })
    } catch (err) {
      if (err instanceof AbacatePayError) {
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

        return failure("ABACATEPAY_ERROR", "Falha ao consultar status da Cobrança PIX.", 502)
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
