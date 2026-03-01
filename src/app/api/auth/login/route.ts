import { NextRequest } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { AUTH_ERRORS } from "@/lib/errors/auth-errors"
import { success, failure } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { comparePassword } from "@/lib/security/bcrypt"
import { generateToken } from "@/lib/security/jwt"
import { rateLimit } from "@/lib/security/rate-limit"
import { loginSchema } from "@/lib/validators/auth"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    body.email = body.email?.trim().toLowerCase()

    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Erro de validação",
        400,
        parsed.error.issues.map((issue) => ({
          field:
            typeof issue.path[0] === "string" ||
            typeof issue.path[0] === "number"
              ? issue.path[0]
              : undefined,
          message: issue.message,
        }))
      )
    }

    const { email, password } = parsed.data

    const allowed = rateLimit(`login:${email}`, {
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

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user || user.status !== "ACTIVE") {
      return failure(
        AUTH_ERRORS.INVALID_CREDENTIALS.code,
        AUTH_ERRORS.INVALID_CREDENTIALS.message,
        401
      )
    }

    const passwordMatch = await comparePassword(
      password,
      user.passwordHash
    )

    if (!passwordMatch) {
      return failure(
        AUTH_ERRORS.INVALID_CREDENTIALS.code,
        AUTH_ERRORS.INVALID_CREDENTIALS.message,
        401
      )
    }

    const token = generateToken(user.id)

    return success({ token })
  } catch (err) {
    return handleError(err)
  }
}