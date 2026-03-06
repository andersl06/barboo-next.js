"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"
import { PremiumBackground } from "@/components/background"
import { getAccessToken, getTempToken } from "@/lib/client/session"

type BarberRouteGuardProps = {
  children: ReactNode
}

export function BarberRouteGuard({ children }: BarberRouteGuardProps) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const tempToken = getTempToken()
    const accessToken = getAccessToken()
    const isChangePasswordPath = pathname === "/barber/change-password"

    if (isChangePasswordPath) {
      if (tempToken) return
      if (accessToken) {
        router.replace("/barber/dashboard")
        return
      }

      router.replace("/login?next=%2Fbarber%2Fdashboard")
      return
    }

    if (tempToken) {
      router.replace("/barber/change-password")
      return
    }

    if (!accessToken) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
  }, [pathname, router])

  const hasWindow = typeof window !== "undefined"
  const tempToken = hasWindow ? getTempToken() : null
  const accessToken = hasWindow ? getAccessToken() : null
  const isChangePasswordPath = pathname === "/barber/change-password"
  const canRender = isChangePasswordPath ? Boolean(tempToken) : Boolean(accessToken && !tempToken)

  if (!canRender) {
    return (
      <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
        <PremiumBackground />
        <section className="relative z-10 mx-auto flex min-h-[40svh] max-w-5xl items-center justify-center rounded-3xl border border-white/10 bg-[#0d1434]/70">
          <p className="text-[#d0d7ef]">Validando acesso...</p>
        </section>
      </main>
    )
  }

  return <>{children}</>
}
