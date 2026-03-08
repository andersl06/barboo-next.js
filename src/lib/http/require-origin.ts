type OriginCheckResult = { ok: true } | { ok: false; status: number; message: string }

function resolveAllowedOrigins() {
  const appUrl = process.env.APP_URL
  if (!appUrl) return null

  try {
    const origin = new URL(appUrl).origin
    const parsedOrigin = new URL(origin)
    const hostname = parsedOrigin.hostname
    const hasWww = hostname.startsWith("www.")
    const alternateHostname = hasWww ? hostname.slice(4) : `www.${hostname}`
    const alternateOrigin = `${parsedOrigin.protocol}//${alternateHostname}`
    return new Set([origin, alternateOrigin])
  } catch {
    return null
  }
}

function resolveRequestOrigin(req: Request) {
  const originHeader = req.headers.get("origin")
  if (originHeader) return originHeader

  const referer = req.headers.get("referer")
  if (!referer) return null

  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

export function requireSameOrigin(req: Request): OriginCheckResult {
  const allowedOrigins = resolveAllowedOrigins()
  if (!allowedOrigins) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, status: 500, message: "APP_URL nao configurada." }
    }
    return { ok: true }
  }

  const requestOrigin = resolveRequestOrigin(req)
  if (!requestOrigin) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, status: 403, message: "Origem ausente." }
    }
    return { ok: true }
  }

  if (!allowedOrigins.has(requestOrigin)) {
    return { ok: false, status: 403, message: "Origem invalida." }
  }

  return { ok: true }
}
