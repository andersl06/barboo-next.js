import { prisma } from "@/lib/db/prisma"

export async function ensureOwnerBarberProfile(userId: string) {
  const existing = await prisma.barberProfile.findUnique({
    where: { userId },
    select: { id: true, userId: true },
  })

  if (existing) {
    return {
      created: false,
      profileId: existing.id,
    }
  }

  const created = await prisma.barberProfile.create({
    data: { userId },
    select: { id: true, userId: true },
  })

  return {
    created: true,
    profileId: created.id,
  }
}
