"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { PremiumBackground } from "@/components/background"
import { UIButton } from "@/components/ui/UIButton"
import { getAccessToken } from "@/lib/client/session"

type ApiErrorDetail = {
  field?: string | number
  message: string
}

type ApiFailure = {
  success: false
  code: string
  message: string
  errors?: ApiErrorDetail[]
}

type ApiResult<T> = { success: true; data: T } | ApiFailure

type FavoriteItem = {
  id: string
  barbershopId: string
  createdAt: string
  isFavorited: boolean
  barbershop: {
    id: string
    slug: string | null
    name: string
    description: string | null
    logoUrl: string | null
    city: string | null
    neighborhood: string | null
    avgPrice: number | null
    avgTimeMinutes: number | null
    rating: number | null
    ratingCount: number
    distanceKm: number | null
  }
}

type FavoritesData = {
  count: number
  items: FavoriteItem[]
}

type ScreenState = "loading" | "unauthenticated" | "ready" | "empty"

function resolveErrorMessage(result: ApiFailure) {
  return result.errors?.[0]?.message ?? result.message
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path
        d="M12 20s-6.5-4.15-8.7-7.35C1.1 9.55 2.4 6 5.9 6c2.1 0 3.25 1.25 4.1 2.3.85-1.05 2-2.3 4.1-2.3 3.5 0 4.8 3.55 2.6 6.65C18.5 15.85 12 20 12 20Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function ClienteFavoritosPage() {
  const [screen, setScreen] = useState<ScreenState>("loading")
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const loadFavorites = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setScreen("unauthenticated")
      return
    }

    setRefreshing(true)
    setError(null)

    try {
      const response = await fetch("/api/favorites", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      })
      const result = (await response.json()) as ApiResult<FavoritesData>

      if (!result.success) {
        setError(resolveErrorMessage(result))
        setScreen("empty")
        return
      }

      setItems(result.data.items)
      setScreen(result.data.items.length > 0 ? "ready" : "empty")
    } catch {
      setError("Falha de conexao ao carregar favoritos.")
      setScreen("empty")
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFavorites()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadFavorites])

  async function removeFavorite(item: FavoriteItem) {
    const token = getAccessToken()
    if (!token) {
      setScreen("unauthenticated")
      return
    }

    setRemovingId(item.barbershopId)
    setError(null)

    try {
      const response = await fetch(`/api/favorites/${item.barbershopId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = (await response.json()) as ApiResult<{ favorited: boolean }>
      if (!result.success) {
        setError(resolveErrorMessage(result))
        return
      }

      const nextItems = items.filter((entry) => entry.barbershopId !== item.barbershopId)
      setItems(nextItems)
      setScreen(nextItems.length > 0 ? "ready" : "empty")
    } catch {
      setError("Falha de conexao ao remover favorito.")
    } finally {
      setRemovingId(null)
    }
  }

  if (screen === "unauthenticated") {
    return (
      <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
        <PremiumBackground />
        <section className="relative z-10 mx-auto max-w-3xl rounded-3xl border border-white/10 bg-[#0d1434]/80 p-6 text-center">
          <p className="text-[#d0d7ef]">Voce precisa fazer login para acessar favoritos.</p>
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
      <section className="relative z-10 mx-auto w-full max-w-6xl rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,54,0.9)_0%,rgba(13,17,41,0.94)_100%)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.6)] md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Favoritos</h1>
            <p className="mt-1 text-sm text-[#a7b1d0] md:text-base">
              Suas barbearias favoritas em um so lugar.
            </p>
          </div>
          <UIButton
            type="button"
            variant="secondary"
            className="!w-auto !px-4 !py-2 !text-sm"
            onClick={() => void loadFavorites()}
            disabled={refreshing}
          >
            {refreshing ? "Atualizando..." : "Atualizar"}
          </UIButton>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        {screen === "loading" ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <article key={index} className="animate-pulse rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
                <div className="h-5 w-1/2 rounded bg-white/10" />
                <div className="mt-2 h-4 w-1/3 rounded bg-white/10" />
                <div className="mt-4 h-9 w-full rounded-xl bg-white/10" />
              </article>
            ))}
          </div>
        ) : screen === "empty" ? (
          <div className="mt-6 rounded-2xl border border-white/12 bg-[#0b1330]/80 p-5">
            <p className="text-base font-semibold text-[#dbe4ff]">Voce ainda nao tem favoritos</p>
            <p className="mt-1 text-sm text-[#b7c3e7]">
              Explore barbearias proximas e adicione suas preferidas.
            </p>
            <UIButton href="/cliente/barbearias-proximas" className="mt-4 !w-auto !px-4 !py-2 !text-sm">
              Encontrar barbearias
            </UIButton>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    {item.barbershop.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.barbershop.logoUrl}
                        alt={`Logo ${item.barbershop.name}`}
                        className="h-11 w-11 rounded-xl border border-white/15 object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-[#121d48] text-xs font-semibold text-[#d5e0ff]">
                        {item.barbershop.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold">{item.barbershop.name}</h2>
                      <p className="truncate text-xs text-[#a7b1d0]">
                        {[item.barbershop.neighborhood, item.barbershop.city].filter(Boolean).join(" - ") || "Local nao informado"}
                      </p>
                    </div>
                  </div>
                  {item.barbershop.distanceKm !== null ? (
                    <span className="rounded-full border border-[#6aa3ff]/35 bg-[#6aa3ff]/15 px-2 py-0.5 text-xs font-semibold text-[#cfe0ff]">
                      {item.barbershop.distanceKm.toFixed(1)} km
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-[#cdd7f6]">
                  {item.barbershop.rating !== null ? (
                    <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-100">
                      {item.barbershop.rating.toFixed(1)} ({item.barbershop.ratingCount})
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-[#9eabd4]">Sem avaliacoes</span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  {item.barbershop.slug ? (
                    <Link
                      href={`/barbearias/${item.barbershop.slug}`}
                      className="inline-flex flex-1 items-center justify-center rounded-xl border border-[#ff965f]/30 bg-gradient-to-b from-[#f36c20] via-[#e0531e] to-[#cb4518] px-3 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(243,108,32,0.25),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:brightness-110"
                    >
                      Ver barbearia
                    </Link>
                  ) : (
                    <span className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-[#111c47] px-3 py-2 text-sm font-semibold text-[#95a5d7]">
                      Link indisponivel
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void removeFavorite(item)}
                    disabled={removingId === item.barbershopId}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#f36c20]/45 bg-[#f36c20]/18 text-[#ffd6bf] transition hover:bg-[#f36c20]/28 disabled:cursor-not-allowed disabled:opacity-70"
                    title="Remover dos favoritos"
                  >
                    <HeartIcon />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

