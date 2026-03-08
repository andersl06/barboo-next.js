import { prisma } from "@/lib/db/prisma"
import { markPastConfirmedAppointmentsAsCompleted } from "@/lib/finance/appointments"
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"
import { success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"

async function handler(_req: Request) {
  try {
    const barbershops = await prisma.barbershop.findMany({
      select: { id: true },
    })

    let updatedCount = 0
    let processed = 0
    const failures: { barbershopId: string; message: string }[] = []

    for (const shop of barbershops) {
      processed += 1
      try {
        const result = await markPastConfirmedAppointmentsAsCompleted(shop.id)
        updatedCount += result.updatedCount
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro desconhecido"
        failures.push({ barbershopId: shop.id, message })
      }
    }

    return success({
      barbershopsProcessed: processed,
      updatedCount,
      failuresCount: failures.length,
      failures: failures.slice(0, 20),
    })
  } catch (err) {
    return handleError(err)
  }
}

export const POST = verifySignatureAppRouter(handler)
