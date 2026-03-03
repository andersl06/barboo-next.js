import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { uploadBarberAvatar } from "@/lib/barber/upload-barber-avatar"
import { BARBER_PROFILE_ERRORS } from "@/lib/errors/barber-profile-errors"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])
const MAX_SIZE = 2 * 1024 * 1024

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const profile = await prisma.barberProfile.findUnique({
      where: { userId: auth.user.id },
      select: { id: true },
    })

    if (!profile) {
      return failure(BARBER_PROFILE_ERRORS.BARBER_PROFILE_NOT_FOUND.code, BARBER_PROFILE_ERRORS.BARBER_PROFILE_NOT_FOUND.message, 404)
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return failure(BARBER_PROFILE_ERRORS.AVATAR_REQUIRED.code, BARBER_PROFILE_ERRORS.AVATAR_REQUIRED.message, 400, [{
        field: BARBER_PROFILE_ERRORS.AVATAR_REQUIRED.field,
        message: BARBER_PROFILE_ERRORS.AVATAR_REQUIRED.message,
      }])
    }

    if (!ACCEPTED_TYPES.has(file.type)) {
      return failure(BARBER_PROFILE_ERRORS.AVATAR_INVALID_TYPE.code, BARBER_PROFILE_ERRORS.AVATAR_INVALID_TYPE.message, 400, [{
        field: BARBER_PROFILE_ERRORS.AVATAR_INVALID_TYPE.field,
        message: BARBER_PROFILE_ERRORS.AVATAR_INVALID_TYPE.message,
      }])
    }

    if (file.size > MAX_SIZE) {
      return failure(BARBER_PROFILE_ERRORS.AVATAR_TOO_LARGE.code, `${BARBER_PROFILE_ERRORS.AVATAR_TOO_LARGE.message} Limite: 2MB.`, 400, [{
        field: BARBER_PROFILE_ERRORS.AVATAR_TOO_LARGE.field,
        message: `${BARBER_PROFILE_ERRORS.AVATAR_TOO_LARGE.message} Limite: 2MB.`,
      }])
    }

    const upload = await uploadBarberAvatar({
      userId: auth.user.id,
      fileBuffer: await file.arrayBuffer(),
      contentType: file.type,
    })

    const updated = await prisma.barberProfile.update({
      where: { userId: auth.user.id },
      data: { avatarUrl: upload.publicUrl },
      select: {
        userId: true,
        avatarUrl: true,
      },
    })

    return success(updated)
  } catch (err) {
    if (err instanceof Error && err.message === "STORAGE_UNAVAILABLE") {
      return failure(BARBER_PROFILE_ERRORS.STORAGE_UNAVAILABLE.code, BARBER_PROFILE_ERRORS.STORAGE_UNAVAILABLE.message, 503)
    }

    if (err instanceof Error && err.message === "AVATAR_INVALID_TYPE") {
      return failure(BARBER_PROFILE_ERRORS.AVATAR_INVALID_TYPE.code, BARBER_PROFILE_ERRORS.AVATAR_INVALID_TYPE.message, 400)
    }

    return handleError(err)
  }
}
