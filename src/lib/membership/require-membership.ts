import { prisma } from "@/lib/db/prisma"
import type { MembershipRole } from "@prisma/client"

export type MembershipSuccess = {
  userId: string
  role: MembershipRole
  barbershopId: string
}

export type MembershipError = {
  error: true
  status: 403 | 400
  message: string
}

export type MembershipResult = MembershipSuccess | MembershipError

export async function requireMembership(
  user: { id: string },
  barbershopId: string,
  allowedRoles?: MembershipRole[]
): Promise<MembershipResult> {
  if (!barbershopId) {
    return { error: true, status: 400, message: "BarbershopId obrigatório" }
  }

  const membership = await prisma.barbershopMembership.findUnique({
    where: {
      userId_barbershopId: {
        userId: user.id,
        barbershopId,
      },
    },
  })

  if (!membership || !membership.isActive) {
    return { error: true, status: 403, message: "Acesso negado" }
  }

  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    return { error: true, status: 403, message: "Permissão insuficiente" }
  }

  return {
    userId: user.id,
    role: membership.role,
    barbershopId,
  }
}
