import { ChargeStatus } from "@/lib/billing/types"

export const MERCADOPAGO_PROVIDER = "mercado_pago"

export function normalizeQrCodeImage(base64: string | null | undefined) {
  if (!base64) return null
  const trimmed = base64.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("data:image")) return trimmed
  return `data:image/png;base64,${trimmed}`
}

export function toAmountCents(amount: number | null) {
  if (amount === null) return null
  if (!Number.isFinite(amount)) return null
  return Math.round(amount * 100)
}

export function mapMercadoPagoStatus(
  rawStatus: string | null | undefined,
  expiresAt?: Date | string | null
): ChargeStatus {
  const normalized = (rawStatus ?? "").trim().toLowerCase()

  if (["approved"].includes(normalized)) {
    return "PAID"
  }

  if (["cancelled", "rejected", "refunded", "charged_back", "expired", "partially_refunded"].includes(normalized)) {
    return "EXPIRED"
  }

  if (["pending", "in_process", "authorized", "in_mediation"].includes(normalized)) {
    return "PENDING"
  }

  if (expiresAt) {
    const expiresAtDate = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt
    if (!Number.isNaN(expiresAtDate.getTime()) && expiresAtDate.getTime() <= Date.now()) {
      return "EXPIRED"
    }
  }

  return "UNKNOWN"
}
