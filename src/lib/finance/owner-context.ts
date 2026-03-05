import { requireAuth } from "@/lib/auth/require-auth"
import { resolveOwnerBarbershopId } from "@/lib/membership/resolve-owner-barbershop"

export type OwnerFinanceContext =
  | {
      userId: string
      barbershopId: string
    }
  | {
      error: true
      status: 401 | 403
      code: "UNAUTHORIZED" | "FORBIDDEN"
      message: string
    }

export async function requireOwnerFinanceContext(req: Request): Promise<OwnerFinanceContext> {
  const auth = await requireAuth(req)
  if ("error" in auth) {
    return {
      error: true,
      status: auth.status,
      code: "UNAUTHORIZED",
      message: auth.message,
    }
  }

  const barbershopId = await resolveOwnerBarbershopId(auth.user.id)
  if (!barbershopId) {
    return {
      error: true,
      status: 403,
      code: "FORBIDDEN",
      message: "Acesso permitido apenas para owner com barbearia ativa.",
    }
  }

  return {
    userId: auth.user.id,
    barbershopId,
  }
}

