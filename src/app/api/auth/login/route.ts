import { NextRequest } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { loginSchema } from "@/lib/validators/auth"
import { success, failure } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { comparePassword } from "@/lib/security/bcrypt"
import { generateToken } from "@/lib/security/jwt"
import { rateLimit } from "@/lib/security/rate-limit"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // normalização
    body.email = body.email?.trim().toLowerCase()

    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return failure("INVALID_CREDENTIALS", "Email ou senha inválidos", 401)
    }

    const { email, password } = parsed.data

    // RATE LIMIT
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
      where: { email }
    })

    // resposta genérica (anti enumeração)
    if (!user) {
      return failure("INVALID_CREDENTIALS", "Email ou senha inválidos", 401)
    }

    if (user.status === "SUSPENDED") {
      return failure("ACCOUNT_SUSPENDED", "Conta suspensa", 403)
    }

    const passwordMatch = await comparePassword(
      password,
      user.passwordHash
    )

    if (!passwordMatch) {
      return failure("INVALID_CREDENTIALS", "Email ou senha inválidos", 401)
    }

    const token = generateToken(user.id)

    return success({
      token
    })

  } catch (err) {
    return handleError(err)
  }
}