const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function isWhatsappWindowOpen(
  lastInboundAt: Date | null,
  now = new Date()
) {
  if (!lastInboundAt) return false
  const diff = now.getTime() - lastInboundAt.getTime()
  return diff >= 0 && diff <= ONE_DAY_MS
}
