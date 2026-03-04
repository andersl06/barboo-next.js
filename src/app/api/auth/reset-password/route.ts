import { Prisma } from "@prisma/client"
import { hashPasswordResetToken } from "@/lib/auth/password-reset"
import { prisma } from "@/lib/db/prisma"
import { AUTH_ERRORS } from "@/lib/errors/auth-errors"
import { failure, success } from "@/lib/http/api-response"
import { getClientIp } from "@/lib/http/client-ip"
import { handleError } from "@/lib/http/error-handler"
import { hashPassword } from "@/lib/security/bcrypt"
import { rateLimit } from "@/lib/security/rate-limit"
import { resetPasswordSchema } from "@/lib/validators/auth"

function invalidTokenResponse() {
  return failure(
    AUTH_ERRORS.PASSWORD_RESET_TOKEN_INVALID.code,
    AUTH_ERRORS.PASSWORD_RESET_TOKEN_INVALID.message,
    400,
    [
      {
        field: AUTH_ERRORS.PASSWORD_RESET_TOKEN_INVALID.field,
        message: AUTH_ERRORS.PASSWORD_RESET_TOKEN_INVALID.message,
      },
    ]
  )
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const allowed = rateLimit(`reset-password:ip:${ip}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 40,
      blockDurationMs: 15 * 60 * 1000,
    })

    if (!allowed) {
      return failure(
        "TOO_MANY_ATTEMPTS",
        "Muitas tentativas. Tente novamente mais tarde.",
        429
      )
    }

    const rawBody = await req.json().catch(() => ({}))
    const parsed = resetPasswordSchema.safeParse(rawBody)
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Erro de validacao",
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

    const tokenHash = hashPasswordResetToken(parsed.data.token)
    const now = new Date()

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: {
            status: true,
          },
        },
      },
    })

    if (
      !resetToken ||
      resetToken.usedAt !== null ||
      resetToken.expiresAt <= now ||
      resetToken.user.status !== "ACTIVE"
    ) {
      return invalidTokenResponse()
    }

    const passwordHash = await hashPassword(parsed.data.password)

    const updated = await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
        },
      })

      if (consumed.count !== 1) {
        return false
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          mustChangePassword: false,
        },
      })

      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
          id: { not: resetToken.id },
        },
        data: {
          usedAt: now,
        },
      })

      return true
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    if (!updated) {
      return invalidTokenResponse()
    }

    return success({
      message: "Senha alterada com sucesso. Faca login com a nova senha.",
    })
  } catch (err) {
    return handleError(err)
  }
}
