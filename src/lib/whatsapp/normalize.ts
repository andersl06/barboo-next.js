export function normalizeWhatsappDigits(value: string | null | undefined) {
  if (!value) return ""

  const digits = value.replace(/\D/g, "")
  if (!digits) return ""

  if (digits.startsWith("55") && digits.length >= 12) {
    return digits
  }

  if (digits.length <= 11) {
    return `55${digits}`
  }

  return digits
}
