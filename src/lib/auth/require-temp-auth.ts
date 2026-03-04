import { TEMP_TOKEN_COOKIE, readCookie } from "@/lib/auth/session-cookies"
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

function extractHeaderToken(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }

  const token = authHeader.replace("Bearer ", "").trim()
  return token.length > 0 ? token : null
}

function resolveTempUserId(req: Request) {
  const headerToken = extractHeaderToken(req)
  const cookieToken = readCookie(req, TEMP_TOKEN_COOKIE)

  const candidates = [headerToken, cookieToken].filter(
    (value): value is string => Boolean(value)
  )

  for (const token of candidates) {
    try {
      const payload = verifyToken(token)
      if (payload.type !== "temp") {
        continue
      }
      return payload.userId
    } catch {
      continue
    }
  }

  return null
}

export async function requireTempAuth(req: Request): Promise<TempAuthResult> {
  const userId = resolveTempUserId(req)
  if (!userId) {
    return { error: true, status: 401, message: "Nao autenticado" }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, mustChangePassword: true },
  })

  if (!user) {
    return { error: true, status: 401, message: "Usuario nao encontrado" }
  }

  if (user.status !== "ACTIVE") {
    return { error: true, status: 403, message: "Usuario suspenso" }
  }

  if (!user.mustChangePassword) {
    return { error: true, status: 403, message: "Troca de senha nao e necessaria" }
  }

  return { userId: user.id }
}

