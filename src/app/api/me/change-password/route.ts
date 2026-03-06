import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { AUTH_ERRORS } from "@/lib/errors/auth-errors"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { comparePassword, hashPassword } from "@/lib/security/bcrypt"
import { changeMyPasswordSchema } from "@/lib/validators/me"

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const parsed = changeMyPasswordSchema.safeParse(await req.json())
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

    const currentUser = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: {
        id: true,
        passwordHash: true,
      },
    })

    if (!currentUser) {
      return failure("UNAUTHORIZED", "Usuário não encontrado.", 401)
    }

    const isCurrentPasswordValid = await comparePassword(
      parsed.data.currentPassword,
      currentUser.passwordHash
    )

    if (!isCurrentPasswordValid) {
      return failure(
        AUTH_ERRORS.INVALID_CREDENTIALS.code,
        "Senha atual inválida.",
        400,
        [{ field: "currentPassword", message: "Senha atual inválida." }]
      )
    }

    const passwordHash = await hashPassword(parsed.data.newPassword)

    await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        passwordHash,
      },
      select: { id: true },
    })

    return success({ changed: true })
  } catch (err) {
    return handleError(err)
  }
}

