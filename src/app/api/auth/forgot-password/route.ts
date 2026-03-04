import { NextRequest } from "next/server"
import { createPasswordResetToken, getPasswordResetExpiryDate } from "@/lib/auth/password-reset"
import { prisma } from "@/lib/db/prisma"
import { sendPasswordResetEmail } from "@/lib/email"
import { AUTH_ERRORS } from "@/lib/errors/auth-errors"
import { failure, success } from "@/lib/http/api-response"
import { getClientIp } from "@/lib/http/client-ip"
import { handleError } from "@/lib/http/error-handler"
import { rateLimit } from "@/lib/security/rate-limit"
import { forgotPasswordSchema } from "@/lib/validators/auth"

function resolveAppUrl(req: NextRequest) {
  const fromEnv = process.env.APP_URL?.trim()
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "")
  }

  const requestUrl = new URL(req.url)
  return `${requestUrl.protocol}//${requestUrl.host}`
}

function genericAcceptedResponse() {
  return success({
    message: AUTH_ERRORS.PASSWORD_RESET_REQUEST_ACCEPTED.message,
  })
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)

    const ipAllowed = rateLimit(`forgot-password:ip:${ip}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 60,
      blockDurationMs: 15 * 60 * 1000,
    })

    if (!ipAllowed) {
      return failure(
        "TOO_MANY_ATTEMPTS",
        "Muitas tentativas. Tente novamente mais tarde.",
        429
      )
    }

    const rawBody = await req.json().catch(() => ({}))
    if (typeof rawBody.email === "string") {
      rawBody.email = rawBody.email.trim().toLowerCase()
    }

    const parsed = forgotPasswordSchema.safeParse(rawBody)
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

    const email = parsed.data.email
    const emailAllowed = rateLimit(`forgot-password:email:${email}:${ip}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 5,
      blockDurationMs: 15 * 60 * 1000,
    })

    if (!emailAllowed) {
      return failure(
        "TOO_MANY_ATTEMPTS",
        "Muitas tentativas. Tente novamente mais tarde.",
        429
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
      },
    })

    if (!user || user.status !== "ACTIVE") {
      return genericAcceptedResponse()
    }

    const { token, tokenHash } = createPasswordResetToken()
    const now = new Date()
    const expiresAt = getPasswordResetExpiryDate()

    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
        },
      })

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      })
    })

    const resetUrl = `${resolveAppUrl(req)}/auth/reset-password?token=${encodeURIComponent(token)}`

    try {
      await sendPasswordResetEmail({
        to: user.email,
        recipientName: user.name,
        resetUrl,
      })
    } catch (sendErr) {
      console.error("[forgot-password] failed to send email", sendErr)
    }

    return genericAcceptedResponse()
  } catch (err) {
    return handleError(err)
  }
}
