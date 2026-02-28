import { prisma } from "@/lib/db/prisma"
import type { MembershipRole } from "@prisma/client"
import type { User } from "@prisma/client"

export type MembershipSuccess = {
  user: User
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
  user: User,
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

  // valida role se necessário
  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    return { error: true, status: 403, message: "Permissão insuficiente" }
  }

  return {
    user,
    role: membership.role,
    barbershopId,
  }
}