"use client"

const LEGACY_ACCESS_TOKEN_KEY = "barboo.accessToken"
const LEGACY_TEMP_TOKEN_KEY = "barboo.tempToken"
const ACCESS_MARKER_COOKIE = "barboo_session"
const TEMP_MARKER_COOKIE = "barboo_temp_session"

type MeContextData = {
  user: {
    id: string
    name: string
    email: string
    onboardingIntent: "CLIENT" | "OWNER"
    onboardingStatus: "PENDING" | "DONE"
    mustChangePassword: boolean
  }
  effectiveRole: "OWNER" | "BARBER" | "CLIENT"
  ownerBarbershopId: string | null
  ownerBarbershopSlug: string | null
  barberBarbershopId: string | null
  barbershopStatus: string | null
  onboardingPending: boolean
  hasBarberProfile: boolean
  hasClientLocation: boolean
  clientLocationUpdatedAt: string | null
}

type ApiSuccess<T> = {
  success: true
  data: T
}

type ApiFailure = {
  success: false
  code: string
  message: string
}

type ApiResult<T> = ApiSuccess<T> | ApiFailure

function cookieValue(name: string) {
  if (typeof document === "undefined") return null
  const entries = document.cookie.split(";")
  for (const entry of entries) {
    const [rawKey, ...rawValue] = entry.trim().split("=")
    if (rawKey !== name) continue
    return rawValue.join("=") || null
  }
  return null
}

function setMarkerCookie(name: string, enabled: boolean) {
  if (typeof document === "undefined") return
  const maxAge = enabled ? 60 * 60 * 24 * 7 : 0
  document.cookie = `${name}=${enabled ? "1" : ""}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
}

function cleanupLegacyLocalStorage() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY)
  window.localStorage.removeItem(LEGACY_TEMP_TOKEN_KEY)
}

export function setAccessToken(token: string) {
  void token
  cleanupLegacyLocalStorage()
  setMarkerCookie(ACCESS_MARKER_COOKIE, true)
  setMarkerCookie(TEMP_MARKER_COOKIE, false)
}

export function getAccessToken() {
  return cookieValue(ACCESS_MARKER_COOKIE) === "1" ? "cookie-session" : null
}

export function clearAccessToken() {
  cleanupLegacyLocalStorage()
  setMarkerCookie(ACCESS_MARKER_COOKIE, false)
  if (typeof window !== "undefined") {
    void fetch("/api/auth/logout", {
      method: "POST",
      keepalive: true,
    }).catch(() => {})
  }
}

export function setTempToken(token: string) {
  void token
  cleanupLegacyLocalStorage()
  setMarkerCookie(TEMP_MARKER_COOKIE, true)
  setMarkerCookie(ACCESS_MARKER_COOKIE, false)
}

export function clearTempToken() {
  cleanupLegacyLocalStorage()
  setMarkerCookie(TEMP_MARKER_COOKIE, false)
  if (typeof window !== "undefined") {
    void fetch("/api/auth/clear-temp", {
      method: "POST",
      keepalive: true,
    }).catch(() => {})
  }
}

export function getTempToken() {
  return cookieValue(TEMP_MARKER_COOKIE) === "1" ? "cookie-temp" : null
}

export async function fetchMeContext(token?: string | null): Promise<ApiResult<MeContextData>> {
  const shouldAttachHeader =
    typeof token === "string" &&
    token.length > 0 &&
    token !== "cookie-session" &&
    token !== "cookie-temp"

  const response = await fetch("/api/me/context", {
    method: "GET",
    ...(shouldAttachHeader
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : {}),
    cache: "no-store",
  })

  return response.json() as Promise<ApiResult<MeContextData>>
}
