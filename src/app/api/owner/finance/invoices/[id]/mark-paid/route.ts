import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { requireOwnerFinanceContext } from "@/lib/finance/owner-context"
import { refreshBarbershopFinancialState } from "@/lib/finance/invoices"
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
        id: parsedParams.data.id,
        barbershopId: context.barbershopId,
      },
      select: {
        id: true,
        status: true,
      },
    })

    if (!invoice) {
      return failure("NOT_FOUND", "Fatura nao encontrada.", 404)
    }

    const updated = await prisma.weeklyInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
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
    return handleError(err)
  }
}

