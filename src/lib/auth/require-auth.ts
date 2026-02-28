import { prisma } from "@/lib/db/prisma"
import { verifyToken, type JwtPayload } from "@/lib/security/jwt"
import type { User } from "@prisma/client"

export type AuthSuccess = {
  user: User
}

export type AuthError = {
  error: true
  status: 401 | 403
  message: string
}

export type AuthResult = AuthSuccess | AuthError

export async function requireAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization")

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: true, status: 401, message: "Não autenticado" }
  }

  const token = authHeader.replace("Bearer ", "")

  let payload: JwtPayload

  try {
    payload = verifyToken(token)
  } catch {
    return { error: true, status: 401, message: "Token inválido ou expirado" }
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  })

  if (!user) {
    return { error: true, status: 401, message: "Usuário não encontrado" }
  }

  if (user.status !== "ACTIVE") {
    return { error: true, status: 403, message: "Usuário suspenso" }
  }

  if (user.mustChangePassword) {
    return {
      error: true,
      status: 403,
      message: "Altere sua senha antes de continuar",
    }
  }

  return { user }
}