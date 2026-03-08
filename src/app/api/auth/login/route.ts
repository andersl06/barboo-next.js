import { NextRequest } from "next/server"
import { setAccessSessionCookies, setTempSessionCookies } from "@/lib/auth/session-cookies"
import { prisma } from "@/lib/db/prisma"
import { AUTH_ERRORS } from "@/lib/errors/auth-errors"
import { failure, success } from "@/lib/http/api-response"
import { getClientIp } from "@/lib/http/client-ip"
import { handleError } from "@/lib/http/error-handler"
import { comparePassword } from "@/lib/security/bcrypt"
import { generateTempToken, generateToken } from "@/lib/security/jwt"
import { rateLimit } from "@/lib/security/rate-limit"
import { loginSchema } from "@/lib/validators/auth"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Erro de Validação",
        400,
        parsed.error.issues.map((issue) => ({
          field:
            typeof issue.path[0] === "string" || typeof issue.path[0] === "number"
              ? issue.path[0]
              : undefined,
          message: issue.message,
        }))
      )
    }

    const { login, password } = parsed.data
    const ip = getClientIp(req)

    const allowed = rateLimit(`login:${login}:${ip}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 5,
      blockDurationMs: 15 * 60 * 1000,
    })

    if (!allowed) {
      return failure(
        "TOO_MANY_ATTEMPTS",
        "Muitas tentativas. Tente novamente mais tarde.",
        429
      )
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: login },
          { phone: login },
        ],
      },
    })

    if (!user || user.status !== "ACTIVE") {
      return failure(
        AUTH_ERRORS.INVALID_CREDENTIALS.code,
        AUTH_ERRORS.INVALID_CREDENTIALS.message,
        401
      )
    }

    const passwordMatch = await comparePassword(password, user.passwordHash)
    if (!passwordMatch) {
      return failure(
        AUTH_ERRORS.INVALID_CREDENTIALS.code,
        AUTH_ERRORS.INVALID_CREDENTIALS.message,
        401
      )
    }

    if (user.mustChangePassword) {
      const tempToken = generateTempToken(user.id)
      const response = success({ mustChangePassword: true })
      setTempSessionCookies(response, tempToken)
      return response
    }

    const token = generateToken(user.id)
    const response = success({ mustChangePassword: false })
    setAccessSessionCookies(response, token)
    return response
  } catch (err) {
    return handleError(err)
  }
}
