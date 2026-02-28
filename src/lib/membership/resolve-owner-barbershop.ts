// /lib/membership/resolve-owner-barbershop.ts

import { prisma } from "@/lib/db/prisma"

export async function resolveOwnerBarbershopId(userId: string) {
  const membership = await prisma.barbershopMembership.findFirst({
    where: {
      userId,
      role: "OWNER",
      isActive: true,
    },
    select: {
      barbershopId: true,
    },
  })

  return membership?.barbershopId ?? null
}