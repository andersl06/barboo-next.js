import { requireAuth } from "@/lib/auth/require-auth"
import { ensureBarberMembership } from "@/lib/barber/ensure-barber-membership"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { prisma } from "@/lib/db/prisma"
import { success, failure } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireMembership } from "@/lib/membership/require-membership"
import { z } from "zod"

const schema = z.object({
  canManageBlocks: z.boolean(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ barberUserId: string }> }
) {
  try {
    const { barberUserId } = await params
    const barbershopId = new URL(req.url).searchParams.get("barbershopId")

    if (!barbershopId) {
      return failure("BAD_REQUEST", "barbershopId e obrigatorio", 400)
    }

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

    const targetMembership = await ensureBarberMembership(barbershopId, barberUserId)
    if (!targetMembership) {
      return failure("NOT_FOUND", "Barbeiro nao encontrado na barbearia", 404)
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
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

    const updated = await prisma.barbershopMembership.update({
      where: {
        userId_barbershopId: {
          userId: barberUserId,
          barbershopId,
        },
      },
      data: {
        canManageBlocks: parsed.data.canManageBlocks,
      },
      select: {
        userId: true,
        barbershopId: true,
        canManageBlocks: true,
      },
    })

    return success(updated)
  } catch (err) {
    return handleError(err)
  }
}
