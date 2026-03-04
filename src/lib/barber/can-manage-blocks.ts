import { prisma } from "@/lib/db/prisma"
import { SCHEDULE_ERRORS } from "@/lib/errors/schedule-errors"
import type { MembershipRole } from "@prisma/client"

type CanManageBlocksParams = {
  actorUserId: string
  actorRole: MembershipRole
  barbershopId: string
  barberUserId: string
}

export async function canManageBlocks(params: CanManageBlocksParams) {
  if (params.actorRole === "OWNER") {
    if (params.actorUserId !== params.barberUserId) {
      return { ok: true as const }
    }

    const ownerBarberProfile = await prisma.barberProfile.findUnique({
      where: { userId: params.actorUserId },
      select: { id: true },
    })

    if (!ownerBarberProfile) {
      return {
        ok: false as const,
        status: 403,
        error: SCHEDULE_ERRORS.BARBER_CANNOT_MANAGE_BLOCKS,
      }
    }

    return { ok: true as const }
  }

  if (params.actorUserId !== params.barberUserId) {
    return {
      ok: false as const,
      status: 403,
      error: SCHEDULE_ERRORS.BARBER_CANNOT_MANAGE_BLOCKS,
    }
  }

  const membership = await prisma.barbershopMembership.findUnique({
    where: {
      userId_barbershopId: {
        userId: params.actorUserId,
        barbershopId: params.barbershopId,
      },
    },
    select: {
      isActive: true,
      role: true,
      canManageBlocks: true,
    },
  })

  if (
    !membership
    || !membership.isActive
    || membership.role !== "BARBER"
    || !membership.canManageBlocks
  ) {
    return {
      ok: false as const,
      status: 403,
      error: SCHEDULE_ERRORS.BARBER_CANNOT_MANAGE_BLOCKS,
    }
  }

  return { ok: true as const }
}
