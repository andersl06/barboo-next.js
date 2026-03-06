import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { BARBER_PROFILE_ERRORS } from "@/lib/errors/barber-profile-errors"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { updateBarberScheduleSchema } from "@/lib/validators/barber-schedule-update"

async function getCurrentBarberMembershipBarbershopId(userId: string) {
  const ownerMembership = await prisma.barbershopMembership.findFirst({
    where: { userId, role: "OWNER", isActive: true },
    select: { barbershopId: true },
  })

  if (ownerMembership) {
    return ownerMembership.barbershopId
  }

  const barberMembership = await prisma.barbershopMembership.findFirst({
    where: { userId, role: "BARBER", isActive: true },
    select: { barbershopId: true },
  })

  return barberMembership?.barbershopId ?? null
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const barbershopId = await getCurrentBarberMembershipBarbershopId(auth.user.id)
    if (!barbershopId) {
      return failure("FORBIDDEN", "Acesso negado", 403)
    }

    const profile = await prisma.barberProfile.findUnique({
      where: { userId: auth.user.id },
      select: {
        userId: true,
        weeklySchedule: true,
      },
    })

    if (!profile) {
      return failure(BARBER_PROFILE_ERRORS.BARBER_PROFILE_NOT_FOUND.code, BARBER_PROFILE_ERRORS.BARBER_PROFILE_NOT_FOUND.message, 404)
    }

    return success(profile)
  } catch (err) {
    return handleError(err)
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const barbershopId = await getCurrentBarberMembershipBarbershopId(auth.user.id)
    if (!barbershopId) {
      return failure("FORBIDDEN", "Acesso negado", 403)
    }

    const body = await req.json()
    const parsed = updateBarberScheduleSchema.safeParse(body)

    if (!parsed.success) {
      return failure("VALIDATION_ERROR", "Erro de validação", 400, parsed.error.issues.map((issue) => ({
        field: typeof issue.path[0] === "string" || typeof issue.path[0] === "number" ? issue.path[0] : undefined,
        message: issue.message,
      })))
    }

    const profile = await prisma.barberProfile.findUnique({
      where: { userId: auth.user.id },
      select: { id: true },
    })

    if (!profile) {
      return failure(BARBER_PROFILE_ERRORS.BARBER_PROFILE_NOT_FOUND.code, BARBER_PROFILE_ERRORS.BARBER_PROFILE_NOT_FOUND.message, 404)
    }

    const updated = await prisma.barberProfile.update({
      where: { userId: auth.user.id },
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
