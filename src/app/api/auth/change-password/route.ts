import { prisma } from "@/lib/db/prisma"
import { AUTH_ERRORS } from "@/lib/errors/auth-errors"
import { success, failure } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireTempAuth } from "@/lib/auth/require-temp-auth"
import { hashPassword } from "@/lib/security/bcrypt"
import { generateToken } from "@/lib/security/jwt"
import { changePasswordSchema } from "@/lib/validators/auth"

export async function PATCH(req: Request) {
  try {
    const auth = await requireTempAuth(req)

    if ("error" in auth) {
      return failure(AUTH_ERRORS.TEMP_TOKEN_INVALID.code, AUTH_ERRORS.TEMP_TOKEN_INVALID.message, auth.status)
    }

    const body = await req.json()
    const parsed = changePasswordSchema.safeParse(body)

    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Erro de validação",
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

    const passwordHash = await hashPassword(parsed.data.newPassword)

    const user = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    const token = generateToken(user.id)

    return success({ token, user })
  } catch (err) {
    return handleError(err)
  }
}
