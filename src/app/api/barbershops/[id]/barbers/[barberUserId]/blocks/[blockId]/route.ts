import { canManageBlocks } from "@/lib/barber/can-manage-blocks"
import { requireAuth } from "@/lib/auth/require-auth"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { prisma } from "@/lib/db/prisma"
import { SCHEDULE_ERRORS } from "@/lib/errors/schedule-errors"
import { success, failure } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireMembership } from "@/lib/membership/require-membership"

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; barberUserId: string; blockId: string }> }
) {
  try {
    const { id: barbershopId, barberUserId, blockId } = await params

    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const barbershopStatus = await requireActiveBarbershop(barbershopId, { allowSetup: true })
    if ("error" in barbershopStatus) {
      return failure(barbershopStatus.code, barbershopStatus.message, barbershopStatus.status)
    }

    const membership = await requireMembership(auth.user, barbershopId, ["OWNER", "BARBER"])
    if ("error" in membership) {
      return failure("FORBIDDEN", membership.message, membership.status)
    }

    const permission = await canManageBlocks({
      actorUserId: auth.user.id,
      actorRole: membership.role,
      barbershopId,
      barberUserId,
    })

    if (!permission.ok) {
      return failure(permission.error.code, permission.error.message, permission.status)
    }

    const block = await prisma.barberBlock.findFirst({
      where: {
        id: blockId,
        barbershopId,
        barberUserId,
      },
      select: { id: true },
    })

    if (!block) {
      return failure(
        SCHEDULE_ERRORS.BARBER_BLOCK_NOT_FOUND.code,
        SCHEDULE_ERRORS.BARBER_BLOCK_NOT_FOUND.message,
        404
      )
    }

    await prisma.barberBlock.delete({ where: { id: blockId } })

    return success({ deleted: true })
  } catch (err) {
    return handleError(err)
  }
}
