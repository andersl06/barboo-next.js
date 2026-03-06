import { buildSupabaseHeaders, getSupabaseServerConfig } from "@/lib/integrations/supabase/server-client"

const BUCKET = "barbershop-media"

function extensionFromContentType(contentType: string) {
  if (contentType === "image/png") return "png"
  if (contentType === "image/jpeg") return "jpg"
  if (contentType === "image/webp") return "webp"

  return null
}

export async function uploadBarberAvatar(input: { userId: string; fileBuffer: ArrayBuffer; contentType: string }) {
  const ext = extensionFromContentType(input.contentType)

  if (!ext) {
    throw new Error("AVATAR_INVALID_TYPE")
  }

  const config = getSupabaseServerConfig()
  const filePath = `barbers/${input.userId}/avatar.${ext}`
  const uploadUrl = `${config.url}/storage/v1/object/${BUCKET}/${filePath}?upsert=true`

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: buildSupabaseHeaders(config.serviceRoleKey, input.contentType),
    body: input.fileBuffer,
  })

  if (!uploadResponse.ok) {
    throw new Error("STORAGE_UNAVAILABLE")
  }

  const publicUrl = `${config.url}/storage/v1/object/public/${BUCKET}/${filePath}`

  return { publicUrl }
}
