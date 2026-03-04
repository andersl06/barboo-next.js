"use client"

const ACCESS_TOKEN_KEY = "barboo.accessToken"
const TEMP_TOKEN_KEY = "barboo.tempToken"

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
  barbershopStatus: string | null
  onboardingPending: boolean
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

export function setAccessToken(token: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function setTempToken(token: string) {
  window.localStorage.setItem(TEMP_TOKEN_KEY, token)
}

export function clearTempToken() {
  window.localStorage.removeItem(TEMP_TOKEN_KEY)
}

export async function fetchMeContext(token: string): Promise<ApiResult<MeContextData>> {
  const response = await fetch("/api/me/context", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  })

  return response.json() as Promise<ApiResult<MeContextData>>
}
