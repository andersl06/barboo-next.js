"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { PremiumBackground } from "@/components/background"
import { getAccessToken } from "@/lib/client/session"

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

type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday"

type DayOpening = {
  enabled: boolean
  start?: string
  end?: string
}

type BarbershopDetail = {
  id: string
  slug: string
  name: string
  description: string | null
  phone: string | null
  logoUrl: string | null
  coverUrl: string | null
  address: string | null
  addressNumber: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  openingHours: Partial<Record<DayKey, DayOpening>> | null
  categories: Array<{
    id: string
    name: string
  }>
  services: Array<{
    id: string
    categoryId: string | null
    name: string
    priceCents: number
    durationMinutes: number
  }>
  barbers: Array<{
    userId: string
    name: string
    bio: string | null
    avatarUrl: string | null
  }>
}

type ScreenState = "loading" | "error" | "ready"
type ActiveTab = "overview" | "services" | "location" | "team"
type ServiceGroup = {
  id: string
  name: string
  services: BarbershopDetail["services"]
}
type OpeningRow = {
  day: string
  value: string
}

const WEEK_DAYS: Array<{ key: DayKey; label: string }> = [
  { key: "monday", label: "Segunda" },
  { key: "tuesday", label: "Terca" },
  { key: "wednesday", label: "Quarta" },
  { key: "thursday", label: "Quinta" },
  { key: "friday", label: "Sexta" },
  { key: "saturday", label: "Sabado" },
  { key: "sunday", label: "Domingo" },
]

const TABS: Array<{ id: ActiveTab; label: string }> = [
  { id: "overview", label: "Visao geral" },
  { id: "services", label: "Serviços" },
  { id: "location", label: "Localização" },
  { id: "team", label: "Equipe" },
]

function sanitizePhone(value: string | null) {
  if (!value) return null
  const digits = value.replace(/\D/g, "")
  return digits.length > 0 ? digits : null
}

function toWhatsappPhone(value: string | null) {
  const digits = sanitizePhone(value)
  if (!digits) return null
  if (digits.startsWith("55")) return digits
  return `55${digits}`
}

function formatPhoneDisplay(value: string | null) {
  const digits = sanitizePhone(value)
  if (!digits) return null

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  return value
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function getBookingHref(slug: string, serviceId?: string) {
  const base = `/barbearias/${slug}/agendar`
  if (!serviceId) {
    return base
  }

  const params = new URLSearchParams({ serviceId })
  return `${base}?${params.toString()}`
}

function getLoginHrefForBooking(slug: string, serviceId?: string) {
  const bookingHref = getBookingHref(slug, serviceId)
  return `/login?next=${encodeURIComponent(bookingHref)}`
}

function getMapsHref(shop: BarbershopDetail) {
  if (shop.latitude !== null && shop.longitude !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`
  }

  const address = [shop.address, shop.addressNumber, shop.neighborhood, shop.city, shop.state]
    .filter(Boolean)
    .join(", ")

  if (!address) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

function getOpeningRows(openingHours: BarbershopDetail["openingHours"]): OpeningRow[] {
  return WEEK_DAYS.map((day) => {
    const data = openingHours?.[day.key]
    if (!data || !data.enabled || !data.start || !data.end) {
      return {
        day: day.label,
        value: "Fechado",
      }
    }

    return {
      day: day.label,
      value: `${data.start} - ${data.end}`,
    }
  })
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function distanceInKm(fromLat: number, fromLon: number, toLat: number, toLon: number) {
  const earthRadiusKm = 6371
  const dLat = toRadians(toLat - fromLat)
  const dLon = toRadians(toLon - fromLon)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "BR"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

function OverviewSection({
  description,
  phoneLabel,
  telDigits,
  whatsappPhone,
  openingRows,
}: {
  description: string | null
  phoneLabel: string | null
  telDigits: string | null
  whatsappPhone: string | null
  openingRows: OpeningRow[]
}) {
  return (
    <article className="rounded-2xl border border-white/12 bg-[#0b1330]/84 p-4 md:p-5">
      <h2 className="text-xl font-semibold">Visao geral</h2>

      <p className="mt-3 text-sm leading-relaxed text-[#d2daf3] md:text-base">
        {description?.trim() || "Descrição da barbearia ainda não informada."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {phoneLabel ? (
          <span className="rounded-lg border border-white/15 bg-[#0a112c]/75 px-3 py-1.5 text-sm text-[#e8eeff]">
            Telefone: {phoneLabel}
          </span>
        ) : (
          <span className="rounded-lg border border-white/15 bg-[#0a112c]/75 px-3 py-1.5 text-sm text-[#e8eeff]">
            Telefone não informado
          </span>
        )}

        {whatsappPhone ? (
          <a
            href={`https://wa.me/${whatsappPhone}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[#6aa3ff]/35 bg-[#6aa3ff]/15 px-3 py-1.5 text-sm font-semibold text-[#d8e8ff] hover:bg-[#6aa3ff]/22"
          >
            WhatsApp
          </a>
        ) : null}

        {telDigits ? (
          <a
            href={`tel:${telDigits}`}
            className="rounded-lg border border-white/15 bg-[#0a112c]/75 px-3 py-1.5 text-sm font-semibold text-[#d8e8ff] hover:bg-[#121c49]"
          >
            Ligar
          </a>
        ) : null}
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#b8c5ea]">
          Horários de funcionamento
        </h3>
        <div className="mt-2 space-y-1.5">
          {openingRows.map((row) => (
            <div key={row.day} className="flex items-center gap-2 text-sm">
              <span className="text-[#dce4ff]">{row.day}</span>
              <span className="h-px flex-1 border-b border-dotted border-white/25" />
              <span className="font-medium text-[#f2f5ff]">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

function ServicesSection({
  serviceGroups,
  openServiceGroups,
  onToggleGroup,
  onStartBooking,
}: {
  serviceGroups: ServiceGroup[]
  openServiceGroups: Record<string, boolean>
  onToggleGroup: (groupId: string) => void
  onStartBooking: (serviceId?: string) => void
}) {
  return (
    <article className="rounded-2xl border border-white/12 bg-[#0b1330]/84 p-4 md:p-5">
      <h2 className="text-xl font-semibold">Serviços</h2>

      <div className="mt-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#b8c5ea]">Categorias</h3>
        {serviceGroups.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {serviceGroups.map((group) => {
              const isOpen = openServiceGroups[group.id] ?? true
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => onToggleGroup(group.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    isOpen
                      ? "border-[#f36c20]/55 bg-[#f36c20]/18 text-[#ffe2d3]"
                      : "border-[#6aa3ff]/35 bg-[#6aa3ff]/15 text-[#d8e8ff]"
                  }`}
                >
                  {group.name}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#c6d1ef]">Sem categorias ativas.</p>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {serviceGroups.length > 0 ? (
          serviceGroups
            .filter((group) => openServiceGroups[group.id] ?? true)
            .map((group) => (
              <div key={group.id} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#a9b9e7]">{group.name}</p>
                {group.services.map((service) => (
                  <div
                    key={service.id}
                    className="flex flex-col gap-2 rounded-lg border border-white/10 bg-[#0b1536]/75 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-[#f0f4ff]">{service.name}</p>
                      <p className="text-xs text-[#b8c5ea]">{service.durationMinutes} min</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-[#f0f4ff]">{formatCurrency(service.priceCents)}</p>
                      <button
                        type="button"
                        onClick={() => onStartBooking(service.id)}
                        className="inline-flex rounded-md border border-[#ff965f]/30 bg-gradient-to-b from-[#f36c20] via-[#e0531e] to-[#cb4518] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
                      >
                        Agendar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))
        ) : (
          <p className="rounded-lg border border-white/10 bg-[#0a112c]/70 p-3 text-sm text-[#c6d1ef]">
            Nenhum Serviço publicado.
          </p>
        )}

        {serviceGroups.length > 0 && serviceGroups.every((group) => !(openServiceGroups[group.id] ?? true)) ? (
          <p className="rounded-lg border border-white/10 bg-[#0a112c]/70 p-3 text-sm text-[#c6d1ef]">
            Nenhuma categoria aberta. Clique em uma categoria para visualizar os Serviços.
          </p>
        ) : null}
      </div>
    </article>
  )
}

function LocationSection({
  addressText,
  distanceHint,
  mapsHref,
}: {
  addressText: string
  distanceHint: string
  mapsHref: string | null
}) {
  return (
    <article className="rounded-2xl border border-white/12 bg-[#0b1330]/84 p-4 md:p-5">
      <h2 className="text-xl font-semibold">Localização</h2>

      <div className="mt-3 rounded-xl border border-white/10 bg-[#0a112c]/72 p-4">
        <p className="text-sm text-[#d0d9f5]">{addressText}</p>
        <p className="mt-2 text-sm text-[#c6d1ef]">{distanceHint}</p>

        {mapsHref ? (
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex rounded-lg border border-white/18 bg-[#0f1b49]/70 px-3 py-2 text-sm font-semibold text-[#e7edff] hover:bg-[#14245f]"
          >
            Abrir no mapa
          </a>
        ) : null}
      </div>
    </article>
  )
}

function TeamSection({ barbers }: { barbers: BarbershopDetail["barbers"] }) {
  return (
    <article className="rounded-2xl border border-white/12 bg-[#0b1330]/84 p-4 md:p-5">
      <h2 className="text-xl font-semibold">Equipe</h2>

      <div className="mt-3 grid gap-2.5">
        {barbers.length > 0 ? (
          barbers.map((barber) => (
            <div key={barber.userId} className="rounded-lg border border-white/10 bg-[#0a112c]/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-full border border-white/15 bg-[#111c4a]">
                    {barber.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={barber.avatarUrl} alt={barber.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#d9e4ff]">
                        {getInitials(barber.name)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{barber.name}</p>
                    <p className="mt-0.5 text-sm text-[#c6d1ef]">{barber.bio ?? "Perfil em configuração."}</p>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-100">
                  Ativo
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-white/10 bg-[#0a112c]/70 p-3 text-sm text-[#c6d1ef]">
            Nenhum barbeiro listado no momento.
          </p>
        )}
      </div>
    </article>
  )
}

export default function BarbeariaDetalhePage() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const slug = typeof params?.slug === "string" ? params.slug : ""
  const [state, setState] = useState<ScreenState>("loading")
  const [error, setError] = useState<string | null>(null)
  const [barbershop, setBarbershop] = useState<BarbershopDetail | null>(null)
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [distanceStatus, setDistanceStatus] = useState<"idle" | "calculating" | "ready" | "permission_denied" | "error" | "unsupported">("idle")
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview")
  const [openServiceGroups, setOpenServiceGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!slug) return

    const timer = window.setTimeout(() => {
      void (async () => {
        setError(null)
        try {
          const response = await fetch(`/api/barbershops/slug/${slug}`, {
            method: "GET",
            cache: "no-store",
          })
          const result = (await response.json()) as ApiResult<BarbershopDetail>
          if (!result.success) {
            setError(result.message)
            setState("error")
            return
          }

          setBarbershop(result.data)
          setState("ready")
        } catch {
          setError("Falha de conexão ao carregar a barbearia.")
          setState("error")
        }
      })()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [slug])

  useEffect(() => {
    if (!barbershop || barbershop.latitude === null || barbershop.longitude === null) return

    const timer = window.setTimeout(() => {
      setDistanceKm(null)

      if (!("geolocation" in navigator)) {
        setDistanceStatus("unsupported")
        return
      }

      setDistanceStatus("calculating")
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const km = distanceInKm(
            position.coords.latitude,
            position.coords.longitude,
            barbershop.latitude as number,
            barbershop.longitude as number
          )
          setDistanceKm(km)
          setDistanceStatus("ready")
        },
        (geoError) => {
          setDistanceKm(null)
          if (geoError.code === geoError.PERMISSION_DENIED) {
            setDistanceStatus("permission_denied")
            return
          }

          setDistanceStatus("error")
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        }
      )
    }, 0)

    return () => window.clearTimeout(timer)
  }, [barbershop])

  const locationText = useMemo(() => {
    if (!barbershop) return ""
    return [barbershop.neighborhood, barbershop.city, barbershop.state]
      .filter(Boolean)
      .join(" - ")
  }, [barbershop])

  const serviceGroups = useMemo<ServiceGroup[]>(() => {
    if (!barbershop) return []

    const groupById = new Map<string, ServiceGroup>()

    for (const category of barbershop.categories) {
      groupById.set(category.id, {
        id: category.id,
        name: category.name,
        services: [],
      })
    }

    const uncategorizedId = "__uncategorized__"
    const uncategorized: ServiceGroup = {
      id: uncategorizedId,
      name: "Sem categoria",
      services: [],
    }

    for (const service of barbershop.services) {
      if (!service.categoryId) {
        uncategorized.services.push(service)
        continue
      }

      const group = groupById.get(service.categoryId)
      if (group) {
        group.services.push(service)
      } else {
        uncategorized.services.push(service)
      }
    }

    const groups = Array.from(groupById.values()).filter((group) => group.services.length > 0)
    if (uncategorized.services.length > 0) {
      groups.push(uncategorized)
    }

    return groups
  }, [barbershop])

  useEffect(() => {
    if (serviceGroups.length === 0) return

    const timer = window.setTimeout(() => {
      setOpenServiceGroups((prev) => {
        const next: Record<string, boolean> = {}
        for (const group of serviceGroups) {
          next[group.id] = prev[group.id] ?? true
        }
        return next
      })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [serviceGroups])

  const hasShopCoordinates = barbershop?.latitude !== null && barbershop?.longitude !== null
  const distanceHint = !hasShopCoordinates
    ? "distância indisponivel."
    : distanceKm !== null
      ? `Aproximadamente ${distanceKm.toFixed(1)} km de Você.`
      : distanceStatus === "calculating"
        ? "Calculando distância..."
        : distanceStatus === "permission_denied"
          ? "Permita Sua localização para calcular a distância."
          : distanceStatus === "unsupported"
            ? "Navegador sem suporte a localização."
            : "Não foi possível calcular a distância."

  if (state === "loading") {
    if (!slug) {
      return (
        <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
          <PremiumBackground />
          <section className="relative z-10 mx-auto max-w-4xl rounded-3xl border border-white/10 bg-[#0d1434]/80 p-6">
            <h1 className="text-2xl font-bold">Slug inválido</h1>
            <p className="mt-2 text-sm text-[#c5cee9]">A URL da barbearia esta incompleta.</p>
            <Link className="mt-4 inline-flex rounded-lg border border-white/15 px-4 py-2 text-sm" href="/">
              Voltar para home
            </Link>
          </section>
        </main>
      )
    }

    return (
      <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
        <PremiumBackground />
        <section className="relative z-10 mx-auto flex min-h-[40svh] max-w-5xl items-center justify-center rounded-3xl border border-white/10 bg-[#0d1434]/70">
          <p className="text-[#d0d7ef]">Carregando barbearia...</p>
        </section>
      </main>
    )
  }

  if (state === "error" || !barbershop) {
    return (
      <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
        <PremiumBackground />
        <section className="relative z-10 mx-auto max-w-4xl rounded-3xl border border-white/10 bg-[#0d1434]/80 p-6">
          <h1 className="text-2xl font-bold">Não foi possível abrir a barbearia</h1>
          <p className="mt-2 text-sm text-[#c5cee9]">{error ?? "Erro inesperado."}</p>
          <Link className="mt-4 inline-flex rounded-lg border border-white/15 px-4 py-2 text-sm" href="/">
            Voltar para home
          </Link>
        </section>
      </main>
    )
  }

  const telDigits = sanitizePhone(barbershop.phone)
  const phoneLabel = formatPhoneDisplay(barbershop.phone)
  const whatsappPhone = toWhatsappPhone(barbershop.phone)
  const mapsHref = getMapsHref(barbershop)
  const openingRows = getOpeningRows(barbershop.openingHours)
  const addressText =
    [barbershop.address, barbershop.addressNumber, barbershop.neighborhood, barbershop.city, barbershop.state]
      .filter(Boolean)
      .join(", ") || "Endereço ainda não informado."

  const handleStartBooking = (serviceId?: string) => {
    const token = getAccessToken()
    if (token) {
      router.push(getBookingHref(barbershop.slug, serviceId))
      return
    }

    router.push(getLoginHrefForBooking(barbershop.slug, serviceId))
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
      <PremiumBackground />
      <section className="relative z-10 mx-auto w-full max-w-6xl rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,54,0.9)_0%,rgba(13,17,41,0.94)_100%)] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.6)] md:p-6">
        <section className="relative overflow-hidden rounded-2xl border border-white/12">
          {barbershop.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={barbershop.coverUrl}
              alt={`Capa da barbearia ${barbershop.name}`}
              className="h-[320px] w-full object-cover md:h-[380px]"
            />
          ) : (
            <div className="h-[320px] w-full bg-[radial-gradient(80%_100%_at_0%_0%,rgba(71,100,215,0.35),rgba(13,19,47,0.95)_55%,rgba(8,12,31,0.98)_100%)] md:h-[380px]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(95deg,rgba(7,10,24,0.92)_0%,rgba(7,10,24,0.65)_45%,rgba(7,10,24,0.35)_100%)]" />

          <div className="absolute inset-0 flex items-end p-5 md:items-center md:p-8">
            <div className="max-w-[620px]">
              <p className="text-xl text-[#f0f3ff] md:text-3xl">Barbearia</p>
              <div className="mt-1 flex flex-wrap items-end gap-3">
                <h1 className="text-4xl font-bold leading-tight text-white md:text-6xl">{barbershop.name}</h1>
                <span className="pb-2 text-sm font-semibold text-[#ffd9bf] md:text-base">
                  {distanceKm !== null ? `${distanceKm.toFixed(1)} km` : "KM --"}
                </span>
              </div>
              <p className="mt-3 text-sm text-[#d0d9f5] md:text-base">
                {locationText || "Endereço em atualizacao"}
              </p>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => handleStartBooking()}
                  className="inline-flex rounded-lg border border-[#ff965f]/30 bg-gradient-to-b from-[#f36c20] via-[#e0531e] to-[#cb4518] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(243,108,32,0.35)] hover:brightness-110"
                >
                  Agendar agora
                </button>
                {whatsappPhone ? (
                  <a
                    href={`https://wa.me/${whatsappPhone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-lg border border-white/20 bg-[#0f1b49]/70 px-4 py-2 text-sm font-semibold text-[#e7edff] hover:bg-[#14245f]"
                  >
                    Entrar em contato
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <nav className="mt-3 border-b border-white/12 px-1">
          <ul className="flex min-w-max items-center gap-4 overflow-x-auto pb-1 text-[15px] text-[#b9c7ef] md:gap-5 md:text-[17px]">
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab
              return (
                <li key={tab.id} className="relative pb-2 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`transition ${isActive ? "font-semibold text-[#f4f7ff]" : "hover:text-white"}`}
                  >
                    {tab.label}
                  </button>
                  {isActive ? (
                    <span className="pointer-events-none absolute -bottom-px left-0 h-[2px] w-full rounded-full bg-gradient-to-r from-[#f36c20] to-[#ffb44c] shadow-[0_0_10px_rgba(243,108,32,0.6)]" />
                  ) : null}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="mt-5">
          {activeTab === "overview" ? (
            <OverviewSection
              description={barbershop.description}
              phoneLabel={phoneLabel}
              telDigits={telDigits}
              whatsappPhone={whatsappPhone}
              openingRows={openingRows}
            />
          ) : null}

          {activeTab === "services" ? (
            <ServicesSection
              serviceGroups={serviceGroups}
              openServiceGroups={openServiceGroups}
              onToggleGroup={(groupId) => {
                setOpenServiceGroups((prev) => ({
                  ...prev,
                  [groupId]: !(prev[groupId] ?? true),
                }))
              }}
              onStartBooking={handleStartBooking}
            />
          ) : null}

          {activeTab === "location" ? (
            <LocationSection
              addressText={addressText}
              distanceHint={distanceHint}
              mapsHref={mapsHref}
            />
          ) : null}

          {activeTab === "team" ? (
            <TeamSection barbers={barbershop.barbers} />
          ) : null}
        </div>
      </section>
    </main>
  )
}
