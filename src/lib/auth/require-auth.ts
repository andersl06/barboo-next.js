import { prisma } from "@/lib/db/prisma"
import { verifyToken, JwtPayload } from "@/lib/security/jwt"

export type AuthSuccess = {
  user: {
    id: string
    name: string
    email: string
    status: string
    mustChangePassword: boolean
    onboardingIntent: string
    onboardingStatus: string
    clientLatitude: number | null
    clientLongitude: number | null
    clientLocationUpdatedAt: Date | null
  }
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

  if (payload.type && payload.type !== "access") {
    return { error: true, status: 401, message: "Token inválido" }
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      mustChangePassword: true,
      onboardingIntent: true,
      onboardingStatus: true,
      clientLatitude: true,
      clientLongitude: true,
      clientLocationUpdatedAt: true,
    },
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

  return {
    user: {
      ...user,
      clientLatitude:
        user.clientLatitude !== null ? Number(user.clientLatitude) : null,
      clientLongitude:
        user.clientLongitude !== null ? Number(user.clientLongitude) : null,
      clientLocationUpdatedAt: user.clientLocationUpdatedAt,
    },
  }
}
