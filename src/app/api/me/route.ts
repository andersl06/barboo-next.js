import { Prisma } from "@prisma/client"
import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { AUTH_ERRORS } from "@/lib/errors/auth-errors"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { updateMeSchema } from "@/lib/validators/me"

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    return success({
      id: auth.user.id,
      name: auth.user.name,
      email: auth.user.email,
      phone: auth.user.phone ?? null,
    })
  } catch (err) {
    return handleError(err)
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const parsed = updateMeSchema.safeParse(await req.json())
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

    const updated = await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    })

    return success(updated)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return failure(
        AUTH_ERRORS.EMAIL_ALREADY_EXISTS.code,
        AUTH_ERRORS.EMAIL_ALREADY_EXISTS.message,
        409,
        [{ field: AUTH_ERRORS.EMAIL_ALREADY_EXISTS.field, message: AUTH_ERRORS.EMAIL_ALREADY_EXISTS.message }]
      )
    }

    return handleError(err)
  }
}

