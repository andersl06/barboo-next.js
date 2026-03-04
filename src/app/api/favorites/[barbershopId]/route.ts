import { Prisma } from "@prisma/client"
import { z } from "zod"
import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { failure, success } from "@/lib/http/api-response"
import { getClientIp } from "@/lib/http/client-ip"
import { handleError } from "@/lib/http/error-handler"
import { rateLimit } from "@/lib/security/rate-limit"

const paramsSchema = z.object({
  barbershopId: z.string().uuid("barbershopId invalido."),
})

function isFavoritesSchemaOutdatedError(err: unknown) {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
    return false
  }

  if (err.code !== "P2021" && err.code !== "P2022") {
    return false
  }

  const message = err.message.toLowerCase()
  const tableName = typeof err.meta?.table === "string" ? err.meta.table.toLowerCase() : ""
  const modelName = typeof err.meta?.modelName === "string" ? err.meta.modelName.toLowerCase() : ""

  return (
    message.includes("favorite") ||
    tableName.includes("favorite") ||
    modelName.includes("favorite")
  )
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ barbershopId: string }> }
) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const ip = getClientIp(req)
    const allowed = rateLimit(`favorites:delete:${auth.user.id}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 120,
    })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisicoes. Tente novamente.", 429)
    }

    const parsedParams = paramsSchema.safeParse(await params)
    if (!parsedParams.success) {
      return failure(
        "VALIDATION_ERROR",
        "Erro de validacao",
        400,
        parsedParams.error.issues.map((issue) => ({
          field:
            typeof issue.path[0] === "string" || typeof issue.path[0] === "number"
              ? issue.path[0]
              : undefined,
          message: issue.message,
        }))
      )
    }

    await prisma.favoriteBarbershop.deleteMany({
      where: {
        userId: auth.user.id,
        barbershopId: parsedParams.data.barbershopId,
      },
    }).catch((err) => {
      if (isFavoritesSchemaOutdatedError(err)) {
        return { count: 0 }
      }
      throw err
    })

    return success({
      favorited: false,
      barbershopId: parsedParams.data.barbershopId,
    })
  } catch (err) {
    return handleError(err)
  }
}
