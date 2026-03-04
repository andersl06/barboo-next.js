import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { failure, success } from "@/lib/http/api-response"
import { getClientIp } from "@/lib/http/client-ip"
import { handleError } from "@/lib/http/error-handler"
import { rateLimit } from "@/lib/security/rate-limit"
import { clientLocationSchema } from "@/lib/validators/client-location"

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    return success({
      hasLocation:
        auth.user.clientLatitude !== null && auth.user.clientLongitude !== null,
      latitude: auth.user.clientLatitude,
      longitude: auth.user.clientLongitude,
      updatedAt: auth.user.clientLocationUpdatedAt,
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

    const ip = getClientIp(req)
    const allowed = rateLimit(`client:location:update:${auth.user.id}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 20,
    })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisicoes. Tente novamente.", 429)
    }

    const parsed = clientLocationSchema.safeParse(await req.json())
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
        clientLatitude: parsed.data.latitude,
        clientLongitude: parsed.data.longitude,
        clientLocationUpdatedAt: new Date(),
      },
      select: {
        clientLatitude: true,
        clientLongitude: true,
        clientLocationUpdatedAt: true,
      },
    })

    return success({
      hasLocation: true,
      latitude: updated.clientLatitude ? Number(updated.clientLatitude) : null,
      longitude: updated.clientLongitude ? Number(updated.clientLongitude) : null,
      updatedAt: updated.clientLocationUpdatedAt,
    })
  } catch (err) {
    return handleError(err)
  }
}
