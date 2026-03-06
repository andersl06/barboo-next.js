import { clearSessionCookies } from "@/lib/auth/session-cookies"
import { success } from "@/lib/http/api-response"

export async function POST() {
  const response = success({ loggedOut: true })
  clearSessionCookies(response)
  return response
}

