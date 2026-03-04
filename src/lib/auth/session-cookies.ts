import type { NextResponse } from "next/server"

export const ACCESS_TOKEN_COOKIE = "barboo_access_token"
export const TEMP_TOKEN_COOKIE = "barboo_temp_token"
export const ACCESS_MARKER_COOKIE = "barboo_session"
export const TEMP_MARKER_COOKIE = "barboo_temp_session"

const ACCESS_MAX_AGE = 60 * 60 * 24 * 7
const TEMP_MAX_AGE = 60 * 15

function secureFlag() {
  return process.env.NODE_ENV === "production"
}

function baseOptions(maxAge: number, httpOnly: boolean) {
  return {
    httpOnly,
    secure: secureFlag(),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", baseOptions(0, true))
  response.cookies.set(TEMP_TOKEN_COOKIE, "", baseOptions(0, true))
  response.cookies.set(ACCESS_MARKER_COOKIE, "", baseOptions(0, false))
  response.cookies.set(TEMP_MARKER_COOKIE, "", baseOptions(0, false))
}

export function setAccessSessionCookies(response: NextResponse, token: string) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, token, baseOptions(ACCESS_MAX_AGE, true))
  response.cookies.set(ACCESS_MARKER_COOKIE, "1", baseOptions(ACCESS_MAX_AGE, false))
  response.cookies.set(TEMP_TOKEN_COOKIE, "", baseOptions(0, true))
  response.cookies.set(TEMP_MARKER_COOKIE, "", baseOptions(0, false))
}

export function setTempSessionCookies(response: NextResponse, token: string) {
  response.cookies.set(TEMP_TOKEN_COOKIE, token, baseOptions(TEMP_MAX_AGE, true))
  response.cookies.set(TEMP_MARKER_COOKIE, "1", baseOptions(TEMP_MAX_AGE, false))
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", baseOptions(0, true))
  response.cookies.set(ACCESS_MARKER_COOKIE, "", baseOptions(0, false))
}

export function readCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get("cookie")
  if (!cookieHeader) return null

  const pairs = cookieHeader.split(";")
  for (const pair of pairs) {
    const [rawKey, ...rawValue] = pair.trim().split("=")
    if (rawKey !== name) continue

    const value = rawValue.join("=")
    if (!value) return null

    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  return null
}

