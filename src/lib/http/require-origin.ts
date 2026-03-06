type OriginCheckResult = { ok: true } | { ok: false; status: number; message: string }

function resolveAllowedOrigin() {
  const appUrl = process.env.APP_URL
  if (!appUrl) return null

  try {
    return new URL(appUrl).origin
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
  const allowedOrigin = resolveAllowedOrigin()
  if (!allowedOrigin) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, status: 500, message: "APP_URL não configurada." }
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

  if (requestOrigin !== allowedOrigin) {
    return { ok: false, status: 403, message: "Origem inválida." }
  }

  return { ok: true }
}
