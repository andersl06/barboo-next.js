import { TEMP_MARKER_COOKIE, TEMP_TOKEN_COOKIE } from "@/lib/auth/session-cookies"
import { success } from "@/lib/http/api-response"

export async function POST() {
  const response = success({ cleared: true })
  response.cookies.set(TEMP_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  response.cookies.set(TEMP_MARKER_COOKIE, "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return response
}

