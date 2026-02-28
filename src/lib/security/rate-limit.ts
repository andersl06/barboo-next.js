const requests = new Map<
  string,
  { count: number; last: number; blockedUntil?: number }
>()

export function rateLimit(
  key: string,
  options?: {
    windowMs?: number
    maxRequests?: number
    blockDurationMs?: number
  }
) {
  const now = Date.now()

  const windowMs = options?.windowMs ?? 60 * 1000
  const maxRequests = options?.maxRequests ?? 10
  const blockDurationMs = options?.blockDurationMs ?? 0

  const entry = requests.get(key)

  if (!entry) {
    requests.set(key, { count: 1, last: now })
    return true
  }

  // se estiver bloqueado
  if (entry.blockedUntil && now < entry.blockedUntil) {
    return false
  }

  if (now - entry.last > windowMs) {
    requests.set(key, { count: 1, last: now })
    return true
  }

  if (entry.count >= maxRequests) {
    if (blockDurationMs > 0) {
      entry.blockedUntil = now + blockDurationMs
    }
    return false
  }

  entry.count++
  entry.last = now
  return true
}