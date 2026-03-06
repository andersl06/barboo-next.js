import { buildSupabaseHeaders, getSupabaseServerConfig } from "@/lib/integrations/supabase/server-client"

const BUCKET = "barbershop-media"

type UploadKind = "logo" | "cover"

type UploadInput = {
  barbershopId: string
  kind: UploadKind
  fileBuffer: ArrayBuffer
  contentType: string
}

function extensionFromContentType(contentType: string) {
  if (contentType === "image/png") return "png"
  if (contentType === "image/jpeg") return "jpg"
  if (contentType === "image/webp") return "webp"

  return null
}

export async function uploadBarbershopImage(input: UploadInput): Promise<{ publicUrl: string }> {
  const ext = extensionFromContentType(input.contentType)

  if (!ext) {
    throw new Error("IMAGE_INVALID_TYPE")
  }

  const config = getSupabaseServerConfig()
  const filePath = `barbershops/${input.barbershopId}/${input.kind}.${ext}`
  const uploadUrl = `${config.url}/storage/v1/object/${BUCKET}/${filePath}`

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: buildSupabaseHeaders(config.serviceRoleKey, input.contentType),
    body: input.fileBuffer,
  })

  if (!uploadResponse.ok) {
    const upsertUrl = `${uploadUrl}?upsert=true`
    const upsertResponse = await fetch(upsertUrl, {
      method: "POST",
      headers: buildSupabaseHeaders(config.serviceRoleKey, input.contentType),
      body: input.fileBuffer,
    })

    if (!upsertResponse.ok) {
      throw new Error("STORAGE_UNAVAILABLE")
    }
  }

  const publicUrl = `${config.url}/storage/v1/object/public/${BUCKET}/${filePath}`

  return { publicUrl }
}
