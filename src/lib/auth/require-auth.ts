import { ACCESS_TOKEN_COOKIE, readCookie } from "@/lib/auth/session-cookies"
import { prisma } from "@/lib/db/prisma"
import { JwtPayload, verifyToken } from "@/lib/security/jwt"

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

function extractHeaderToken(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }

  const token = authHeader.replace("Bearer ", "").trim()
  return token.length > 0 ? token : null
}

function resolvePayload(req: Request): JwtPayload | null {
  const headerToken = extractHeaderToken(req)
  const cookieToken = readCookie(req, ACCESS_TOKEN_COOKIE)

  const candidates = [headerToken, cookieToken].filter(
    (value): value is string => Boolean(value)
  )

  for (const token of candidates) {
    try {
      const payload = verifyToken(token)
      if (payload.type && payload.type !== "access") {
        continue
      }
      return payload
    } catch {
      continue
    }
  }

  return null
}

export async function requireAuth(req: Request): Promise<AuthResult> {
  const payload = resolvePayload(req)
  if (!payload) {
    return { error: true, status: 401, message: "Nao autenticado" }
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
    return { error: true, status: 401, message: "Usuario nao encontrado" }
  }

  if (user.status !== "ACTIVE") {
    return { error: true, status: 403, message: "Usuario suspenso" }
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

