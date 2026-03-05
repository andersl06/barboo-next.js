import { prisma } from "@/lib/db/prisma"

export async function markPastConfirmedAppointmentsAsCompleted(barbershopId: string) {
  const now = new Date()

  const updated = await prisma.barbershopAppointment.updateMany({
    where: {
      barbershopId,
      status: "CONFIRMED",
      endAt: {
        lte: now,
      },
    },
    data: {
      status: "COMPLETED",
    },
  })

  return {
    updatedCount: updated.count,
  }
}

