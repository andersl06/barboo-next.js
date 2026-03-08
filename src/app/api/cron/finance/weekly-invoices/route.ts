import { prisma } from "@/lib/db/prisma"
import { markPastConfirmedAppointmentsAsCompleted } from "@/lib/finance/appointments"
import { generateWeeklyInvoiceForBarbershop } from "@/lib/finance/generate-weekly-invoice"
import { refreshBarbershopFinancialState } from "@/lib/finance/invoices"
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"
import { success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"

const MAX_INVOICE_CYCLES = 8

async function handler(_req: Request) {
  try {
    const barbershops = await prisma.barbershop.findMany({
      select: { id: true },
    })

    let createdCount = 0
    let processed = 0
    const failures: { barbershopId: string; message: string }[] = []

    for (const shop of barbershops) {
      processed += 1
      try {
        await markPastConfirmedAppointmentsAsCompleted(shop.id)

        let cycles = 0
        while (cycles < MAX_INVOICE_CYCLES) {
          const result = await generateWeeklyInvoiceForBarbershop({
            barbershopId: shop.id,
          })
          if (!result.created) break
          createdCount += 1
          cycles += 1
        }

        await refreshBarbershopFinancialState(shop.id)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro desconhecido"
        failures.push({ barbershopId: shop.id, message })
      }
    }

    return success({
      barbershopsProcessed: processed,
      invoicesCreated: createdCount,
      maxCyclesPerBarbershop: MAX_INVOICE_CYCLES,
      failuresCount: failures.length,
      failures: failures.slice(0, 20),
    })
  } catch (err) {
    return handleError(err)
  }
}

export const POST = verifySignatureAppRouter(handler)
