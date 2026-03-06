import { Redis } from "@upstash/redis"

type MemoryBucket = {
  count: number
  expiresAt: number
}

export type RateLimitResult = {
  allowed: boolean
  reason?: "RATE_LIMIT"
}

type MemoryLimiter = {
  check: (waId: string, now: Date, maxPerMinute: number) => RateLimitResult
  clear: () => void
}

export function buildRateLimitKey(waId: string, now = new Date()) {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  const day = String(now.getUTCDate()).padStart(2, "0")
  const hour = String(now.getUTCHours()).padStart(2, "0")
  const minute = String(now.getUTCMinutes()).padStart(2, "0")
  return `wa_rl:${waId}:${year}${month}${day}${hour}${minute}`
}

export function createMemoryRateLimiter(): MemoryLimiter {
  const store = new Map<string, MemoryBucket>()

  return {
    check(waId, now, maxPerMinute) {
      const key = buildRateLimitKey(waId, now)
      const nowMs = now.getTime()
      const current = store.get(key)

      if (!current || current.expiresAt <= nowMs) {
        store.set(key, { count: 1, expiresAt: nowMs + 120_000 })
        return { allowed: true }
      }

      const nextCount = current.count + 1
      current.count = nextCount
      if (nextCount > maxPerMinute) {
        return { allowed: false, reason: "RATE_LIMIT" }
      }

      return { allowed: true }
    },
    clear() {
      store.clear()
    },
  }
}

const memoryLimiter = createMemoryRateLimiter()
let warnedMemory = false

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

export async function checkWhatsappRateLimit(
  waId: string,
  options?: { now?: Date; maxPerMinute?: number }
): Promise<RateLimitResult> {
  const now = options?.now ?? new Date()
  const parsedMax = Number(
    options?.maxPerMinute ?? process.env.WHATSAPP_RL_MAX_PER_MINUTE ?? 10
  )
  const maxPerMinute = Math.max(1, Number.isFinite(parsedMax) ? parsedMax : 10)

  if (!waId) {
    return { allowed: true }
  }

  if (redis) {
    try {
      const key = buildRateLimitKey(waId, now)
      const count = await redis.incr(key)
      if (count === 1) {
        await redis.expire(key, 120)
      }

      if (count > maxPerMinute) {
        return { allowed: false, reason: "RATE_LIMIT" }
      }

      return { allowed: true }
    } catch (error) {
      console.warn("WhatsApp rate limit: redis error, fallback to memory.", error)
    }
  }

  if (!warnedMemory) {
    console.warn(
      "WhatsApp rate limit using in-memory fallback (not safe for serverless/multi-instance)."
    )
    warnedMemory = true
  }

  return memoryLimiter.check(waId, now, maxPerMinute)
}

export function resetMemoryWhatsappRateLimit() {
  memoryLimiter.clear()
}
