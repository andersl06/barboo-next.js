import { prisma } from "@/lib/db/prisma"
import { success, failure } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireAuth } from "@/lib/auth/require-auth"
import { requireMembership } from "@/lib/membership/require-membership"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { z } from "zod"

const schema = z.object({
  canManageBlocks: z.boolean(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; barberUserId: string }> }
) {
  try {
    const { id: barbershopId, barberUserId } = await params

    const auth = await requireAuth(req)

    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const barbershopStatus = await requireActiveBarbershop(barbershopId, { allowSetup: true })
    if ("error" in barbershopStatus) {
      return failure(barbershopStatus.code, barbershopStatus.message, barbershopStatus.status)
    }

    const membership = await requireMembership(auth.user, barbershopId, ["OWNER"])

    if ("error" in membership) {
      return failure("FORBIDDEN", membership.message, membership.status)
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)

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

    const profile = await prisma.barberProfile.upsert({
      where: { userId: barberUserId },
      create: {
        userId: barberUserId,
        canManageBlocks: parsed.data.canManageBlocks,
      },
      update: {
        canManageBlocks: parsed.data.canManageBlocks,
      },
      select: {
        userId: true,
        canManageBlocks: true,
      },
    })

    return success(profile)
  } catch (err) {
    return handleError(err)
  }
}
