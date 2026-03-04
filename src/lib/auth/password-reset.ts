import { createHash, randomBytes } from "crypto"

const DEFAULT_TTL_MINUTES = 30
const MIN_TTL_MINUTES = 5
const MAX_TTL_MINUTES = 60

function resolveSecret() {
  return (
    process.env.PASSWORD_RESET_TOKEN_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    "barboo-password-reset-dev-secret"
  )
}

export function getPasswordResetTtlMinutes() {
  const raw = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? DEFAULT_TTL_MINUTES)
  if (!Number.isFinite(raw)) return DEFAULT_TTL_MINUTES
  return Math.min(Math.max(Math.floor(raw), MIN_TTL_MINUTES), MAX_TTL_MINUTES)
}

export function getPasswordResetExpiryDate() {
  const ttlMinutes = getPasswordResetTtlMinutes()
  return new Date(Date.now() + ttlMinutes * 60 * 1000)
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256")
    .update(`${resolveSecret()}:${token}`)
    .digest("hex")
}

export function createPasswordResetToken() {
  const token = randomBytes(32).toString("base64url")
  return {
    token,
    tokenHash: hashPasswordResetToken(token),
  }
}
