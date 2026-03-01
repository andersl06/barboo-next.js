import { prisma } from "@/lib/db/prisma"
import { verifyToken } from "@/lib/security/jwt"

export type TempAuthSuccess = {
  userId: string
}

export type TempAuthError = {
  error: true
  status: 401 | 403
  message: string
}

export type TempAuthResult = TempAuthSuccess | TempAuthError

export async function requireTempAuth(req: Request): Promise<TempAuthResult> {
  const authHeader = req.headers.get("authorization")

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: true, status: 401, message: "Não autenticado" }
  }

  const token = authHeader.replace("Bearer ", "")

  try {
    const payload = verifyToken(token)

    if (payload.type !== "temp") {
      return { error: true, status: 401, message: "Token temporário inválido" }
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, status: true, mustChangePassword: true },
    })

    if (!user) {
      return { error: true, status: 401, message: "Usuário não encontrado" }
    }

    if (user.status !== "ACTIVE") {
      return { error: true, status: 403, message: "Usuário suspenso" }
    }

    if (!user.mustChangePassword) {
      return { error: true, status: 403, message: "Troca de senha não é necessária" }
    }

    return { userId: user.id }
  } catch {
    return { error: true, status: 401, message: "Token inválido ou expirado" }
  }
}
