import { ensureBarberMembership } from "@/lib/barber/ensure-barber-membership"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { BARBER_PROFILE_ERRORS } from "@/lib/errors/barber-profile-errors"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireMembership } from "@/lib/membership/require-membership"
import { updateBarberScheduleSchema } from "@/lib/validators/barber-schedule-update"

export async function PUT(
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

    const targetMembership = await ensureBarberMembership(barbershopId, barberUserId)
    if (!targetMembership) {
      return failure("NOT_FOUND", "Barbeiro não encontrado na barbearia", 404)
    }

    const body = await req.json()
    const parsed = updateBarberScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return failure("VALIDATION_ERROR", "Erro de validação", 400, parsed.error.issues.map((issue) => ({
        field: typeof issue.path[0] === "string" || typeof issue.path[0] === "number" ? issue.path[0] : undefined,
        message: issue.message,
      })))
    }

    const profile = await prisma.barberProfile.findUnique({ where: { userId: barberUserId }, select: { id: true } })
    if (!profile) {
      return failure(BARBER_PROFILE_ERRORS.BARBER_PROFILE_NOT_FOUND.code, BARBER_PROFILE_ERRORS.BARBER_PROFILE_NOT_FOUND.message, 404)
    }

    const updated = await prisma.barberProfile.update({
      where: { userId: barberUserId },
      data: {
        weeklySchedule: parsed.data.weeklySchedule,
      },
      select: {
        userId: true,
        weeklySchedule: true,
      },
    })

    return success(updated)
  } catch (err) {
    return handleError(err)
  }
}
