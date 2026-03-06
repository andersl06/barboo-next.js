import { requireAuth } from "@/lib/auth/require-auth"
import { ensureBarberMembership } from "@/lib/barber/ensure-barber-membership"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { uploadBarberAvatar } from "@/lib/barber/upload-barber-avatar"
import { prisma } from "@/lib/db/prisma"
import { BARBER_PROFILE_ERRORS } from "@/lib/errors/barber-profile-errors"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireMembership } from "@/lib/membership/require-membership"

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])
const MAX_SIZE = 2 * 1024 * 1024

export async function POST(
  req: Request,
  { params }: { params: Promise<{ barberUserId: string }> }
) {
  try {
    const { barberUserId } = await params
    const barbershopId = new URL(req.url).searchParams.get("barbershopId")

    if (!barbershopId) {
      return failure("BAD_REQUEST", "barbershopId é obrigatório", 400)
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
      return failure("NOT_FOUND", "Barbeiro não encontrado na barbearia", 404)
    }

    const profile = await prisma.barberProfile.findUnique({
      where: { userId: barberUserId },
      select: { id: true },
    })
    if (!profile) {
      return failure(
        BARBER_PROFILE_ERRORS.BARBER_PROFILE_NOT_FOUND.code,
        BARBER_PROFILE_ERRORS.BARBER_PROFILE_NOT_FOUND.message,
        404
      )
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return failure(
        BARBER_PROFILE_ERRORS.AVATAR_REQUIRED.code,
        BARBER_PROFILE_ERRORS.AVATAR_REQUIRED.message,
        400,
        [{
          field: BARBER_PROFILE_ERRORS.AVATAR_REQUIRED.field,
          message: BARBER_PROFILE_ERRORS.AVATAR_REQUIRED.message,
        }]
      )
    }

    if (!ACCEPTED_TYPES.has(file.type)) {
      return failure(
        BARBER_PROFILE_ERRORS.AVATAR_INVALID_TYPE.code,
        BARBER_PROFILE_ERRORS.AVATAR_INVALID_TYPE.message,
        400,
        [{
          field: BARBER_PROFILE_ERRORS.AVATAR_INVALID_TYPE.field,
          message: BARBER_PROFILE_ERRORS.AVATAR_INVALID_TYPE.message,
        }]
      )
    }

    if (file.size > MAX_SIZE) {
      return failure(
        BARBER_PROFILE_ERRORS.AVATAR_TOO_LARGE.code,
        `${BARBER_PROFILE_ERRORS.AVATAR_TOO_LARGE.message} Limite: 2MB.`,
        400,
        [{
          field: BARBER_PROFILE_ERRORS.AVATAR_TOO_LARGE.field,
          message: `${BARBER_PROFILE_ERRORS.AVATAR_TOO_LARGE.message} Limite: 2MB.`,
        }]
      )
    }

    const upload = await uploadBarberAvatar({
      userId: barberUserId,
      fileBuffer: await file.arrayBuffer(),
      contentType: file.type,
    })

    const updated = await prisma.barberProfile.update({
      where: { userId: barberUserId },
      data: { avatarUrl: upload.publicUrl },
      select: {
        userId: true,
        avatarUrl: true,
      },
    })

    return success(updated)
  } catch (err) {
    if (err instanceof Error && err.message === "STORAGE_UNAVAILABLE") {
      return failure(
        BARBER_PROFILE_ERRORS.STORAGE_UNAVAILABLE.code,
        BARBER_PROFILE_ERRORS.STORAGE_UNAVAILABLE.message,
        503
      )
    }

    if (err instanceof Error && err.message === "AVATAR_INVALID_TYPE") {
      return failure(
        BARBER_PROFILE_ERRORS.AVATAR_INVALID_TYPE.code,
        BARBER_PROFILE_ERRORS.AVATAR_INVALID_TYPE.message,
        400
      )
    }

    return handleError(err)
  }
}
