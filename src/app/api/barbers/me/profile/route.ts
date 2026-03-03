import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { BARBER_PROFILE_ERRORS } from "@/lib/errors/barber-profile-errors"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { updateBarberProfileSchema } from "@/lib/validators/barber-profile-update"

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const body = await req.json()
    const parsed = updateBarberProfileSchema.safeParse(body)

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
      return failure(
        BARBER_PROFILE_ERRORS.BARBER_PROFILE_NOT_FOUND.code,
        BARBER_PROFILE_ERRORS.BARBER_PROFILE_NOT_FOUND.message,
        404
      )
    }

    const updated = await prisma.barberProfile.update({
      where: { userId: auth.user.id },
      data: {
        bio: parsed.data.bio,
      },
      select: {
        userId: true,
        bio: true,
        avatarUrl: true,
        weeklySchedule: true,
      },
    })

    return success(updated)
  } catch (err) {
    return handleError(err)
  }
}
