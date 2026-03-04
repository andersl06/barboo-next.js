"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PremiumBackground } from "@/components/background"
import { UIButton } from "@/components/ui/UIButton"
import { getAccessToken } from "@/lib/client/session"

type ApiErrorDetail = {
  field?: string | number
  message: string
}

type ApiSuccess<T> = {
  success: true
  data: T
}

type ApiFailure = {
  success: false
  code: string
  message: string
  errors?: ApiErrorDetail[]
}

type ApiResult<T> = ApiSuccess<T> | ApiFailure

type NearbyItem = {
  id: string
  slug: string | null
  name: string
  description: string | null
  logoUrl: string | null
  coverUrl: string | null
  city: string | null
  neighborhood: string | null
  avgPrice: number | null
  avgTimeMinutes: number | null
  distanceKm: number
}

type NearbyData = {
  count: number
  items: NearbyItem[]
}

type ScreenState = "loading" | "unauthenticated" | "ready" | "empty"

export default function BarbeariasProximasPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<ScreenState>("loading")
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<NearbyItem[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const loadNearby = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setScreen("unauthenticated")
      return
    }

    setRefreshing(true)
    setError(null)

    try {
      const response = await fetch("/api/client/barbershops/nearby?radiusKm=20&limit=24", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = (await response.json()) as ApiResult<NearbyData>
      if (!result.success) {
        if (result.code === "CLIENT_LOCATION_REQUIRED") {
          router.replace("/cliente/localizacao?next=%2Fcliente%2Fbarbearias-proximas")
          return
        }

        setError(result.errors?.[0]?.message ?? result.message)
        setScreen("empty")
        return
      }

      setItems(result.data.items)
      setScreen(result.data.items.length > 0 ? "ready" : "empty")
    } catch {
      setError("Falha de conexao ao buscar barbearias proximas.")
      setScreen("empty")
    } finally {
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNearby()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadNearby])

  if (screen === "loading") {
    return (
      <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
        <PremiumBackground />
        <section className="relative z-10 mx-auto flex min-h-[40svh] max-w-5xl items-center justify-center rounded-3xl border border-white/10 bg-[#0d1434]/70">
          <p className="text-[#d0d7ef]">Buscando barbearias proximas...</p>
        </section>
      </main>
    )
  }

  if (screen === "unauthenticated") {
    return (
      <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
        <PremiumBackground />
        <section className="relative z-10 mx-auto max-w-3xl rounded-3xl border border-white/10 bg-[#0d1434]/80 p-6 text-center">
          <p className="text-[#d0d7ef]">Voce precisa fazer login para buscar barbearias.</p>
          <Link className="mt-4 inline-flex rounded-lg border border-white/15 px-4 py-2" href="/login">
            Ir para login
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
      <PremiumBackground />
      <section className="relative z-10 mx-auto w-full max-w-6xl rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,54,0.9)_0%,rgba(13,17,41,0.94)_100%)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <h1 className="text-3xl font-bold">Barbearias proximas</h1>
        <p className="mt-2 text-sm text-[#a7b1d0] md:text-base">
          As barbearias mais proximas de você.
        </p>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        <div className="mt-4">
          <UIButton type="button" variant="secondary" onClick={loadNearby} disabled={refreshing}>
            {refreshing ? "Atualizando..." : "Atualizar busca"}
          </UIButton>
        </div>

        {screen === "empty" ? (
          <div className="mt-6 rounded-2xl border border-white/12 bg-[#0b1330]/80 p-4">
            <p className="text-sm text-[#cad2ef]">
              Nenhuma barbearia encontrada no raio atual.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold">{item.name}</h2>
                  <span className="rounded-full border border-[#6aa3ff]/35 bg-[#6aa3ff]/15 px-2 py-0.5 text-xs font-semibold text-[#cfe0ff]">
                    {item.distanceKm.toFixed(1)} km
                  </span>
                </div>

                <p className="mt-1 text-sm text-[#a7b1d0]">
                  {[item.neighborhood, item.city].filter(Boolean).join(" - ") || "Local nao informado"}
                </p>

                {item.description ? (
                  <p className="mt-3 line-clamp-2 text-sm text-[#d2d9f1]">{item.description}</p>
                ) : null}

                <div className="mt-3 flex items-center gap-3 text-xs text-[#c5cee9]">
                  <span>
                    {item.avgPrice !== null ? `Preco medio R$ ${item.avgPrice.toFixed(2)}` : "Preco medio nao informado"}
                  </span>
                  <span>
                    {item.avgTimeMinutes !== null ? `${item.avgTimeMinutes} min` : ""}
                  </span>
                </div>

                {item.slug ? (
                  <Link
                    href={`/barbearias/${item.slug}`}
                    className="mt-4 inline-flex rounded-lg border border-white/15 px-3 py-1.5 text-sm font-semibold text-[#d8e3ff] hover:bg-white/10"
                  >
                    Ver barbearia
                  </Link>
                ) : (
                  <p className="mt-4 text-xs text-[#9ca7cb]">Link publico ainda nao disponivel</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
