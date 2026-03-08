import crypto from "crypto"
import * as jwt from "jsonwebtoken"

type CronAuthResult = { ok: true } | { ok: false; status: number; message: string }

type QstashClaims = jwt.JwtPayload & {
  iss?: string
  sub?: string
  body?: string
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function resolveQstashKeys() {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim()
  const next = process.env.QSTASH_NEXT_SIGNING_KEY?.trim()
  if (!current && !next) return null
  return { current, next }
}

function hashBody(rawBody: string) {
  return crypto.createHash("sha256").update(rawBody).digest("base64url")
}

function resolveAllowedHosts(req: Request) {
  const hosts = new Set<string>()
  const requestUrl = new URL(req.url)
  hosts.add(requestUrl.host)

  const appUrl = process.env.APP_URL?.trim()
  if (appUrl) {
    try {
      const origin = new URL(appUrl).origin
      const parsedOrigin = new URL(origin)
      const hostname = parsedOrigin.hostname
      const hasWww = hostname.startsWith("www.")
      const alternateHostname = hasWww ? hostname.slice(4) : `www.${hostname}`
      hosts.add(parsedOrigin.host)
      hosts.add(`${alternateHostname}${parsedOrigin.port ? `:${parsedOrigin.port}` : ""}`)
    } catch {
      // ignore invalid APP_URL
    }
  }

  return hosts
}

function isAllowedSubject(subject: string, req: Request) {
  try {
    const subjectUrl = new URL(subject)
    const requestUrl = new URL(req.url)
    if (subjectUrl.pathname !== requestUrl.pathname) return false
    const allowedHosts = resolveAllowedHosts(req)
    return allowedHosts.has(subjectUrl.host)
  } catch {
    return false
  }
}

function verifyQstashToken(token: string, key: string, req: Request, expectedBodyHash: string) {
  const payload = jwt.verify(token, key, {
    algorithms: ["HS256"],
    clockTolerance: 10,
  }) as QstashClaims

  if (!payload || typeof payload !== "object") return false
  if (payload.iss !== "Upstash") return false
  if (!payload.sub || !isAllowedSubject(payload.sub, req)) return false
  if (typeof payload.body !== "string") return false
  return safeEqual(payload.body, expectedBodyHash)
}

async function verifyQstashSignature(req: Request) {
  const signature =
    req.headers.get("upstash-signature") ?? req.headers.get("Upstash-Signature")
  if (!signature) return { ok: false, reason: "missing_signature" as const }

  const keys = resolveQstashKeys()
  if (!keys) {
    return { ok: false, reason: "missing_keys" as const }
  }

  const rawBody = await req.text()
  const expectedBodyHash = hashBody(rawBody)

  try {
    if (keys.current && verifyQstashToken(signature, keys.current, req, expectedBodyHash)) {
      return { ok: true, authType: "qstash" as const }
    }
    if (keys.next && verifyQstashToken(signature, keys.next, req, expectedBodyHash)) {
      return { ok: true, authType: "qstash" as const }
    }
  } catch {
    return { ok: false, reason: "invalid_signature" as const }
  }

  return { ok: false, reason: "invalid_signature" as const }
}

export async function requireCronAuth(req: Request): Promise<CronAuthResult> {
  const qstashResult = await verifyQstashSignature(req)
  if (qstashResult.ok) {
    return { ok: true }
  }

  if (qstashResult.reason === "missing_keys") {
    return { ok: false, status: 500, message: "QSTASH signing keys nao configurados." }
  }

  if (qstashResult.reason === "missing_signature") {
    return { ok: false, status: 401, message: "Assinatura QStash ausente." }
  }

  return { ok: false, status: 401, message: "Assinatura QStash invalida." }
}
