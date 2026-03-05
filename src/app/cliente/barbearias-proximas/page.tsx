"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
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
  rating: number | null
  ratingCount: number
  isFavorited: boolean
}

type NearbyData = {
  origin: {
    latitude: number
    longitude: number
    radiusKm: number
  }
  count: number
  items: NearbyItem[]
}

type ScreenState = "loading" | "unauthenticated" | "ready" | "empty"

function resolveErrorMessage(result: ApiFailure) {
  return result.errors?.[0]?.message ?? result.message
}

function getLocationLabel(origin: NearbyData["origin"] | null, items: NearbyItem[]) {
  if (!origin) return "Localizacao nao definida"

  const nearest = items[0]
  if (nearest?.city) {
    return `${nearest.city} • ${nearest.distanceKm.toFixed(1)} km`
  }

  if (nearest) {
    return `${nearest.distanceKm.toFixed(1)} km da barbearia mais proxima`
  }

  return `Localizacao salva • raio ${origin.radiusKm} km`
}

function CardSkeleton() {
  return (
    <article className="animate-pulse overflow-hidden rounded-2xl border border-white/10 bg-[#0b1330]/80">
      <div className="h-28 bg-white/10" />
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="h-5 w-2/3 rounded bg-white/10" />
          <div className="h-5 w-16 rounded-full bg-white/10" />
        </div>
        <div className="mt-2 h-4 w-1/2 rounded bg-white/10" />
        <div className="mt-2 h-4 w-1/3 rounded bg-white/10" />
        <div className="mt-4 h-9 w-full rounded-xl bg-white/10" />
      </div>
    </article>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} className="h-5 w-5">
      <path
        d="M12 20s-6.5-4.15-8.7-7.35C1.1 9.55 2.4 6 5.9 6c2.1 0 3.25 1.25 4.1 2.3.85-1.05 2-2.3 4.1-2.3 3.5 0 4.8 3.55 2.6 6.65C18.5 15.85 12 20 12 20Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M20 12a8 8 0 1 1-2.35-5.65" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 4v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function BarbeariasProximasPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<ScreenState>("loading")
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<NearbyItem[]>([])
  const [origin, setOrigin] = useState<NearbyData["origin"] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [favoriteLoading, setFavoriteLoading] = useState<Record<string, boolean>>({})

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

        setError(resolveErrorMessage(result))
        setScreen("empty")
        return
      }

      setItems(result.data.items)
      setOrigin(result.data.origin)
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

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (normalizedSearch.length === 0) {
      return items
    }

    return items.filter((item) => {
      const fields = [item.name, item.neighborhood, item.city].filter(Boolean).join(" ").toLowerCase()
      return fields.includes(normalizedSearch)
    })
  }, [items, search])

  const locationLabel = useMemo(() => getLocationLabel(origin, items), [origin, items])

  async function toggleFavorite(item: NearbyItem) {
    const token = getAccessToken()
    if (!token) {
      router.push("/login")
      return
    }

    setFavoriteLoading((prev) => ({ ...prev, [item.id]: true }))
    setError(null)

    try {
      const response = await fetch(
        item.isFavorited ? `/api/favorites/${item.id}` : "/api/favorites",
        {
          method: item.isFavorited ? "DELETE" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(item.isFavorited ? {} : { "Content-Type": "application/json" }),
          },
          ...(item.isFavorited
            ? {}
            : {
                body: JSON.stringify({
                  barbershopId: item.id,
                }),
              }),
        }
      )

      const result = (await response.json()) as ApiResult<{ favorited: boolean }>
      if (!result.success) {
        setError(resolveErrorMessage(result))
        return
      }

      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                isFavorited: !item.isFavorited,
              }
            : entry
        )
      )
    } catch {
      setError("Falha de conexao ao atualizar favoritos.")
    } finally {
      setFavoriteLoading((prev) => ({ ...prev, [item.id]: false }))
    }
  }

  if (screen === "loading") {
    return (
      <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
        <PremiumBackground />
        <section className="relative z-10 mx-auto w-full max-w-6xl rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,54,0.9)_0%,rgba(13,17,41,0.94)_100%)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.6)] md:p-6">
          <div className="rounded-2xl border border-white/10 bg-[#0d1434]/80 p-4">
            <div className="h-8 w-60 animate-pulse rounded bg-white/10" />
            <div className="mt-2 h-5 w-80 animate-pulse rounded bg-white/10" />
            <div className="mt-4 h-11 w-full animate-pulse rounded-xl bg-white/10" />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
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
      <section className="relative z-10 mx-auto w-full max-w-6xl rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,54,0.9)_0%,rgba(13,17,41,0.94)_100%)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.6)] md:p-6">
        <header className="sticky top-3 z-20 rounded-2xl border border-white/10 bg-[#0e1738]/95 p-4 backdrop-blur">
          <h1 className="text-3xl font-bold">Barbearias proximas</h1>
          <p className="mt-1 text-sm text-[#a7b1d0] md:text-base">
            Encontre a melhor opcao perto de voce.
          </p>

          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
            <label className="relative block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9cb0e5]">
                <SearchIcon />
              </span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar barbearias, bairro..."
                className="w-full rounded-xl border border-white/12 bg-[#091130]/88 py-2.5 pl-11 pr-3 text-base text-[#f4f6ff] outline-none transition placeholder:text-[#8fa2d8] focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
              />
            </label>
            <div className="flex items-center gap-2">
              <span className="inline-flex max-w-full items-center rounded-full border border-[#6aa3ff]/35 bg-[#6aa3ff]/15 px-3 py-1 text-xs font-semibold text-[#cfe0ff]">
                {locationLabel}
              </span>
              <button
                type="button"
                onClick={() => void loadNearby()}
                disabled={refreshing}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/15 bg-[#101b44] px-2.5 text-xs font-semibold text-[#dce6ff] transition hover:bg-[#18275e] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <RefreshIcon />
                {refreshing ? "..." : "Atualizar"}
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        {screen === "empty" || filteredItems.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/12 bg-[#0b1330]/80 p-5">
            <p className="text-base font-semibold text-[#dbe4ff]">Nao encontramos barbearias proximas</p>
            <p className="mt-1 text-sm text-[#b7c3e7]">
              Ajuste sua localizacao ou tente uma busca manual.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <UIButton
                href="/cliente/localizacao?next=%2Fcliente%2Fbarbearias-proximas"
                className="!w-auto !px-4 !py-2 !text-sm"
              >
                Atualizar localizacao
              </UIButton>
              <button
                type="button"
                onClick={() => void loadNearby()}
                className="inline-flex rounded-lg border border-white/15 bg-[#101b44] px-4 py-2 text-sm font-semibold text-[#dce6ff] transition hover:bg-[#18275e]"
              >
                Buscar manualmente
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => {
              const isFavoriteBusy = Boolean(favoriteLoading[item.id])

              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-white/12 bg-[#0b1330]/85 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
                >
                  <div className="relative h-28 border-b border-white/10 bg-[#101a44]">
                    {item.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.coverUrl}
                        alt={`Capa ${item.name}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(80%_100%_at_0%_0%,rgba(71,100,215,0.35),rgba(13,19,47,0.95)_55%,rgba(8,12,31,0.98)_100%)]">
                        {item.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.logoUrl}
                            alt={`Logo ${item.name}`}
                            className="h-12 w-12 rounded-xl border border-white/20 object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-[#121d48] text-sm font-semibold text-[#d5e0ff]">
                            {item.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07102d]/55 to-transparent" />
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold">{item.name}</h2>
                        <p className="truncate text-xs text-[#a7b1d0]">
                          {[item.neighborhood, item.city].filter(Boolean).join(" - ") || "Local nao informado"}
                        </p>
                      </div>
                      <span className="rounded-full border border-[#6aa3ff]/35 bg-[#6aa3ff]/15 px-2 py-0.5 text-xs font-semibold text-[#cfe0ff]">
                        {item.distanceKm.toFixed(1)} km
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-[#cdd7f6]">
                      {item.rating !== null ? (
                        <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-100">
                          {item.rating.toFixed(1)} ({item.ratingCount})
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[#9eabd4]">Sem avaliacoes</span>
                      )}

                      {item.avgPrice !== null ? (
                        <span>Preco medio R$ {item.avgPrice.toFixed(2)}</span>
                      ) : (
                        <span className="text-[#9eabd4]">Preco medio indisponivel</span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      {item.slug ? (
                        <Link
                          href={`/barbearias/${item.slug}`}
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
                        onClick={() => void toggleFavorite(item)}
                        disabled={isFavoriteBusy}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border text-sm transition ${
                          item.isFavorited
                            ? "border-[#f36c20]/45 bg-[#f36c20]/18 text-[#ffd6bf]"
                            : "border-white/15 bg-[#0d173d] text-[#d7e1ff] hover:bg-[#152154]"
                        } disabled:cursor-not-allowed disabled:opacity-70`}
                        title={item.isFavorited ? "Desfavoritar" : "Favoritar"}
                      >
                        <HeartIcon filled={item.isFavorited} />
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
