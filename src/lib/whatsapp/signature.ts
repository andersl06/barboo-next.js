import crypto from "node:crypto"

export function verifyWhatsappSignature(
  rawBody: string,
  signatureHeader: string,
  appSecret: string
) {
  if (!signatureHeader.startsWith("sha256=")) return false
  const signature = signatureHeader.slice("sha256=".length).trim()
  if (!signature) return false

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex")

  const signatureBuffer = Buffer.from(signature, "hex")
  const expectedBuffer = Buffer.from(expected, "hex")

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
}
