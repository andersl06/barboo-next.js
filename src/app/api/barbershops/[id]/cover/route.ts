import { requireAuth } from "@/lib/auth/require-auth"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { uploadBarbershopImage } from "@/lib/barbershop/upload-barbershop-image"
import { prisma } from "@/lib/db/prisma"
import { UPLOAD_ERRORS } from "@/lib/errors/upload-errors"
import { success, failure } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireMembership } from "@/lib/membership/require-membership"

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])
const MAX_SIZE = 5 * 1024 * 1024

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: barbershopId } = await params

    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const status = await requireActiveBarbershop(barbershopId, { allowSetup: true })
    if ("error" in status) {
      return failure(status.code, status.message, status.status)
    }

    const membership = await requireMembership(auth.user, barbershopId, ["OWNER"])
    if ("error" in membership) {
      return failure("FORBIDDEN", membership.message, membership.status)
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return failure(UPLOAD_ERRORS.IMAGE_REQUIRED.code, UPLOAD_ERRORS.IMAGE_REQUIRED.message, 400, [
        { field: UPLOAD_ERRORS.IMAGE_REQUIRED.field, message: UPLOAD_ERRORS.IMAGE_REQUIRED.message },
      ])
    }

    if (!ACCEPTED_TYPES.has(file.type)) {
      return failure(UPLOAD_ERRORS.IMAGE_INVALID_TYPE.code, UPLOAD_ERRORS.IMAGE_INVALID_TYPE.message, 400, [
        { field: UPLOAD_ERRORS.IMAGE_INVALID_TYPE.field, message: UPLOAD_ERRORS.IMAGE_INVALID_TYPE.message },
      ])
    }

    if (file.size > MAX_SIZE) {
      return failure(UPLOAD_ERRORS.IMAGE_TOO_LARGE.code, `${UPLOAD_ERRORS.IMAGE_TOO_LARGE.message} Limite: 5MB.`, 400, [
        { field: UPLOAD_ERRORS.IMAGE_TOO_LARGE.field, message: `${UPLOAD_ERRORS.IMAGE_TOO_LARGE.message} Limite: 5MB.` },
      ])
    }

    const arrayBuffer = await file.arrayBuffer()
    const upload = await uploadBarbershopImage({
      barbershopId,
      kind: "cover",
      fileBuffer: arrayBuffer,
      contentType: file.type,
    })

    await prisma.barbershop.update({
      where: { id: barbershopId },
      data: { coverUrl: upload.publicUrl },
    })

    return success({ coverUrl: upload.publicUrl })
  } catch (err) {
    if (err instanceof Error && err.message === "STORAGE_UNAVAILABLE") {
      return failure(UPLOAD_ERRORS.STORAGE_UNAVAILABLE.code, UPLOAD_ERRORS.STORAGE_UNAVAILABLE.message, 503)
    }

    if (err instanceof Error && err.message === "IMAGE_INVALID_TYPE") {
      return failure(UPLOAD_ERRORS.IMAGE_INVALID_TYPE.code, UPLOAD_ERRORS.IMAGE_INVALID_TYPE.message, 400)
    }

    return handleError(err)
  }
}
