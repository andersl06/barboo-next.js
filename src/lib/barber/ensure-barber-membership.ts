import { prisma } from "@/lib/db/prisma"

export async function ensureBarberMembership(barbershopId: string, barberUserId: string) {
  const membership = await prisma.barbershopMembership.findUnique({
    where: {
      userId_barbershopId: {
        userId: barberUserId,
        barbershopId,
      },
    },
    select: {
      isActive: true,
      role: true,
    },
  })

  if (!membership || !membership.isActive || membership.role !== "BARBER") {
    return null
  }

  return membership
}
