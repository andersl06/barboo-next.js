"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { PremiumBackground } from "@/components/background"
import { UIButton } from "@/components/ui/UIButton"
import {
  clearAccessToken,
  fetchMeContext,
  getAccessToken,
} from "@/lib/client/session"
import { calculateAppointmentTotals } from "@/lib/finance/fees"
import { buildWhatsappReminderLink, isWithinNext24h } from "@/lib/whatsapp/reminders"

type ApiError = {
  success: false
  code: string
  message: string
  errors?: Array<{
    field?: string | number
    message: string
  }>
}

type ApiResult<T> = { success: true; data: T } | ApiError

type ShopData = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
}

type CatalogService = {
  id: string
  name: string
  description: string | null
  priceCents: number
  durationMinutes: number
}

type CatalogCategory = {
  id: string
  name: string
  description: string | null
  services: CatalogService[]
}

type CatalogData = {
  categories: CatalogCategory[]
  uncategorizedServices: CatalogService[]
}

type BarberItem = {
  userId: string
  role: "OWNER" | "BARBER"
  name: string
  bio: string | null
  avatarUrl: string | null
}

type SlotsData = {
  count: number
  items: Array<{
    time: string
    startAt: string
    endAt: string
  }>
}

type CreatedAppointment = {
  id: string
  status: "PENDING" | "CONFIRMED" | "CANCELED" | "REJECTED" | "COMPLETED"
  startAt: string
  endAt: string
  barbershopId: string
  barbershopName: string
  pricing?: {
    servicePriceCents: number
    serviceFeeCents: number
    totalPriceCents: number
  }
}


type FlowStep = "service" | "barber" | "slot" | "confirm" | "done"

function getTodayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map((value) => Number(value))
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  probe.setUTCDate(probe.getUTCDate() + days)

  const yyyy = probe.getUTCFullYear()
  const mm = String(probe.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(probe.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date)
}

function getLoginHref(slug: string, serviceId?: string) {
  const path = serviceId
    ? `/barbearias/${slug}/agendar?serviceId=${encodeURIComponent(serviceId)}`
    : `/barbearias/${slug}/agendar`
  return `/login?next=${encodeURIComponent(path)}`
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "BR"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

function resolveApiError(result: ApiError, fallback: string) {
  if (result.errors?.[0]?.message) {
    return result.errors[0].message
  }
  return result.message || fallback
}

export default function AgendarBarbeariaPage() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()

  const slug = typeof params?.slug === "string" ? params.slug : ""
  const preselectedServiceId = searchParams.get("serviceId")

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  const [shop, setShop] = useState<ShopData | null>(null)
  const [catalog, setCatalog] = useState<CatalogData | null>(null)
  const [barbers, setBarbers] = useState<BarberItem[]>([])

  const [step, setStep] = useState<FlowStep>("service")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<CatalogService | null>(null)
  const [selectedBarber, setSelectedBarber] = useState<BarberItem | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate())
  const [slots, setSlots] = useState<SlotsData["items"]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [findingNextSlots, setFindingNextSlots] = useState(false)
  const [slotError, setSlotError] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<SlotsData["items"][number] | null>(null)
  const [creating, setCreating] = useState(false)
  const [createdAppointment, setCreatedAppointment] = useState<CreatedAppointment | null>(null)
  const [backCountdown, setBackCountdown] = useState(5)

  const whatsappReminderLink = useMemo(() => {
    if (!createdAppointment) {
      return null
    }

    return buildWhatsappReminderLink({
      appointmentId: createdAppointment.id,
    })
  }, [createdAppointment])

  const shouldShowWhatsappReminder = useMemo(() => {
    if (!createdAppointment) return false
    if (!whatsappReminderLink) return false
    return isWithinNext24h(createdAppointment.startAt)
  }, [createdAppointment, whatsappReminderLink])

  const handleWhatsappReminder = useCallback(() => {
    if (!whatsappReminderLink) return
    window.open(whatsappReminderLink, "_blank")
  }, [whatsappReminderLink])

  const selectedPricing = useMemo(() => {
    if (!selectedService) return null
    return calculateAppointmentTotals(selectedService.priceCents)
  }, [selectedService])

  useEffect(() => {
    if (step !== "done") return

    setBackCountdown(5)
    const timer = window.setInterval(() => {
      setBackCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [step])

  const serviceGroups = useMemo(() => {
    if (!catalog) {
      return []
    }

    const groups = catalog.categories.map((category) => ({
      id: category.id,
      name: category.name,
      services: category.services,
    }))

    if (catalog.uncategorizedServices.length > 0) {
      groups.push({
        id: "__uncategorized__",
        name: "Sem categoria",
        services: catalog.uncategorizedServices,
      })
    }

    return groups
  }, [catalog])

  const visibleServices = useMemo(() => {
    if (serviceGroups.length === 0) return []
    if (!selectedCategoryId) return serviceGroups[0]?.services ?? []
    return serviceGroups.find((group) => group.id === selectedCategoryId)?.services ?? []
  }, [serviceGroups, selectedCategoryId])

  useEffect(() => {
    if (!slug) {
      setError("Slug da barbearia inválido.")
      setLoading(false)
      return
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        setError(null)
        try {
          const currentToken = getAccessToken()
          if (!currentToken) {
            router.replace(getLoginHref(slug, preselectedServiceId ?? undefined))
            return
          }

          const me = await fetchMeContext(currentToken)
          if (!me.success) {
            clearAccessToken()
            router.replace(getLoginHref(slug, preselectedServiceId ?? undefined))
            return
          }

          setToken(currentToken)

          const shopResponse = await fetch(`/api/barbershops/slug/${slug}`, {
            method: "GET",
            cache: "no-store",
          })
          const shopResult = (await shopResponse.json()) as ApiResult<ShopData>
          if (!shopResult.success) {
            setError(resolveApiError(shopResult, "Falha ao carregar barbearia."))
            return
          }

          setShop(shopResult.data)

          const [catalogResponse, barbersResponse] = await Promise.all([
            fetch(`/api/barbershops/${shopResult.data.id}/booking/catalog`, {
              method: "GET",
              cache: "no-store",
            }),
            fetch(`/api/barbershops/${shopResult.data.id}/booking/barbers`, {
              method: "GET",
              cache: "no-store",
            }),
          ])

          const [catalogResult, barbersResult] = (await Promise.all([
            catalogResponse.json() as Promise<ApiResult<CatalogData>>,
            barbersResponse.json() as Promise<ApiResult<BarberItem[]>>,
          ]))

          if (!catalogResult.success) {
            setError(resolveApiError(catalogResult, "Falha ao carregar Serviços."))
            return
          }

          if (!barbersResult.success) {
            setError(resolveApiError(barbersResult, "Falha ao carregar equipe."))
            return
          }

          setCatalog(catalogResult.data)
          setBarbers(barbersResult.data)

          const groups = [
            ...catalogResult.data.categories.map((category) => ({
              id: category.id,
              services: category.services,
            })),
            ...(catalogResult.data.uncategorizedServices.length > 0
              ? [{ id: "__uncategorized__", services: catalogResult.data.uncategorizedServices }]
              : []),
          ]

          if (groups.length > 0) {
            setSelectedCategoryId(groups[0].id)
          }

          if (preselectedServiceId) {
            const groupWithService = groups.find((group) =>
              group.services.some((service) => service.id === preselectedServiceId)
            )
            const service = groupWithService?.services.find(
              (item) => item.id === preselectedServiceId
            )
            if (groupWithService && service) {
              setSelectedCategoryId(groupWithService.id)
              setSelectedService(service)
              setStep("barber")
            }
          }
        } catch {
          setError("Falha de conexão ao carregar o fluxo de agendamento.")
        } finally {
          setLoading(false)
        }
      })()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [preselectedServiceId, router, slug])

  const fetchSlotsForDate = useCallback(async (date: string, updateUi: boolean) => {
    if (!shop || !selectedService || !selectedBarber) {
      return null
    }

    if (updateUi) {
      setLoadingSlots(true)
      setSlotError(null)
      setSlots([])
      setSelectedSlot(null)
    }

    try {
      const query = new URLSearchParams({
        barberId: selectedBarber.userId,
        date,
        serviceDuration: String(selectedService.durationMinutes),
      })

      const response = await fetch(
        `/api/barbershops/${shop.id}/booking/slots?${query.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      )

      const result = (await response.json()) as ApiResult<SlotsData>
      if (!result.success) {
        if (updateUi) {
          setSlotError(resolveApiError(result, "Falha ao buscar Horários Disponíveis."))
        }
        return null
      }

      if (updateUi) {
        setSlots(result.data.items)
      }

      return result.data.items
    } catch {
      if (updateUi) {
        setSlotError("Falha de conexão ao buscar Horários.")
      }
      return null
    } finally {
      if (updateUi) {
        setLoadingSlots(false)
      }
    }
  }, [selectedBarber, selectedService, shop])

  const findNextAvailableDate = useCallback(async () => {
    if (!shop || !selectedService || !selectedBarber) return

    setFindingNextSlots(true)
    setSlotError(null)
    try {
      for (let offset = 1; offset <= 14; offset += 1) {
        const candidateDate = addDays(selectedDate, offset)
        const items = await fetchSlotsForDate(candidateDate, false)
        if (items && items.length > 0) {
          setSelectedDate(candidateDate)
          setSlots(items)
          setSelectedSlot(null)
          setSlotError(null)
          return
        }
      }

      setSlotError("Não encontramos Horários Disponíveis nos Próximos 14 dias.")
    } finally {
      setFindingNextSlots(false)
    }
  }, [fetchSlotsForDate, selectedBarber, selectedDate, selectedService, shop])

  useEffect(() => {
    if (!shop || !selectedService || !selectedBarber || step !== "slot") {
      return
    }

    const timer = window.setTimeout(() => {
      void fetchSlotsForDate(selectedDate, true)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchSlotsForDate, selectedBarber, selectedDate, selectedService, shop, step])

  async function onCreateAppointment() {
    if (!shop || !selectedService || !selectedBarber || !selectedSlot || !token) {
      return
    }

    setCreating(true)
    setError(null)
    try {
      const response = await fetch(`/api/barbershops/${shop.id}/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          barbershopId: shop.id,
          serviceId: selectedService.id,
          barberId: selectedBarber.userId,
          startAt: selectedSlot.startAt,
        }),
      })

      const result = (await response.json()) as ApiResult<CreatedAppointment>
      if (!result.success) {
        if (result.code === "UNAUTHORIZED") {
          clearAccessToken()
          router.replace(getLoginHref(slug, selectedService.id))
          return
        }
        setError(resolveApiError(result, "Não foi possível criar o agendamento."))
        return
      }

      setCreatedAppointment(result.data)
      setStep("done")
    } catch {
      setError("Falha de conexão ao confirmar agendamento.")
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
        <PremiumBackground />
        <section className="relative z-10 mx-auto flex min-h-[42svh] max-w-5xl items-center justify-center rounded-3xl border border-white/10 bg-[#0d1434]/70">
          <p className="text-[#d0d7ef]">Preparando seu agendamento...</p>
        </section>
      </main>
    )
  }

  if (error && !shop) {
    return (
      <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
        <PremiumBackground />
        <section className="relative z-10 mx-auto max-w-3xl rounded-3xl border border-white/10 bg-[#0d1434]/80 p-6">
          <p className="text-sm text-red-100">{error}</p>
          <Link className="mt-4 inline-flex rounded-lg border border-white/15 px-4 py-2 text-sm" href={`/barbearias/${slug}`}>
            Voltar para barbearia
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
      <PremiumBackground />

      <section className="relative z-10 mx-auto w-full max-w-5xl rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,54,0.9)_0%,rgba(13,17,41,0.94)_100%)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.6)] md:p-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Agendamento</p>
            <h1 className="text-2xl font-bold md:text-3xl">Novo agendamento</h1>
          </div>
          <Link
            href={`/barbearias/${slug}`}
            className="inline-flex rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[#d8e3ff] hover:bg-white/10"
          >
            Voltar
          </Link>
        </header>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { id: "service", label: "Serviço" },
            { id: "barber", label: "Barbeiro" },
            { id: "slot", label: "Horário" },
            { id: "confirm", label: "Confirmação" },
          ].map((item) => {
            const order: FlowStep[] = ["service", "barber", "slot", "confirm", "done"]
            const current = order.indexOf(step)
            const own = order.indexOf(item.id as FlowStep)
            const isActive = own <= current
            return (
              <div
                key={item.id}
                className={`h-2 rounded-full transition ${
                  isActive
                    ? "bg-[#f36c20] shadow-[0_0_12px_rgba(243,108,32,0.45)]"
                    : "bg-white/14"
                }`}
                aria-label={`Etapa ${item.label}`}
              />
            )
          })}
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        {step === "service" ? (
          <section className="mt-5 rounded-2xl border border-white/12 bg-[#0b1330]/84 p-4 md:p-5">
            <h2 className="text-lg font-semibold">Escolha o Serviço</h2>

            <div className="mt-3 flex flex-wrap gap-2">
              {serviceGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(group.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    selectedCategoryId === group.id
                      ? "border-[#f36c20]/55 bg-[#f36c20]/16 text-[#ffe4d4]"
                      : "border-[#6aa3ff]/35 bg-[#6aa3ff]/10 text-[#d8e8ff]"
                  }`}
                >
                  {group.name}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-2.5">
              {visibleServices.map((service) => (
                <article
                  key={service.id}
                  className="flex flex-col gap-2 rounded-xl border border-white/10 bg-[#0a122f]/75 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">{service.name}</p>
                    <p className="text-xs text-[#b8c5ea]">
                      {service.durationMinutes} min - {formatCurrency(service.priceCents)}
                    </p>
                  </div>
                  <UIButton
                    type="button"
                    className="!w-auto !px-4 !py-1.5 !text-sm"
                    onClick={() => {
                      setSelectedService(service)
                      setSelectedBarber(null)
                      setSelectedSlot(null)
                      setStep("barber")
                    }}
                  >
                    Selecionar
                  </UIButton>
                </article>
              ))}

              {visibleServices.length === 0 ? (
                <p className="rounded-lg border border-white/10 bg-[#0a112c]/70 p-3 text-sm text-[#c6d1ef]">
                  Nenhum Serviço ativo nesta categoria.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {step === "barber" ? (
          <section className="mt-5 rounded-2xl border border-white/12 bg-[#0b1330]/84 p-4 md:p-5">
            <h2 className="text-lg font-semibold">Escolha o barbeiro</h2>
            <p className="mt-1 text-sm text-[#b8c5ea]">
              Serviço selecionado: <span className="font-semibold text-[#f3f6ff]">{selectedService?.name}</span>
            </p>

            <div className="mt-4 grid gap-2.5 md:grid-cols-2">
              {barbers.map((barber) => (
                <button
                  key={barber.userId}
                  type="button"
                  onClick={() => {
                    setSelectedBarber(barber)
                    setSelectedSlot(null)
                    setStep("slot")
                  }}
                  className="text-left rounded-xl border border-white/12 bg-[#0a122f]/75 p-3 transition hover:border-[#f36c20]/45"
                >
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
                      <p className="text-xs text-[#aeb8db]">{barber.role === "OWNER" ? "Owner barbeiro" : "Barbeiro"}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setStep("service")}
                className="text-sm text-[#b8c5ea] hover:text-white"
              >
                Voltar para Serviços
              </button>
            </div>
          </section>
        ) : null}

        {step === "slot" ? (
          <section className="mt-5 rounded-2xl border border-white/12 bg-[#0b1330]/84 p-4 md:p-5">
            <h2 className="text-lg font-semibold">Escolha o Horário</h2>
            <p className="mt-1 text-sm text-[#b8c5ea]">
              {selectedService?.name} com <span className="font-semibold text-[#f3f6ff]">{selectedBarber?.name}</span>
            </p>

            <label className="mt-4 block text-sm text-[#c9d4f2]">
              Data
              <input
                type="date"
                value={selectedDate}
                min={getTodayDate()}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/14 bg-[#09112d]/80 px-3 py-2 text-sm text-[#eef3ff] outline-none focus:border-[#6aa3ff]/55"
              />
            </label>
            {selectedDate === getTodayDate() ? (
              <p className="mt-2 text-xs text-[#aeb8db]">
                Para hoje, apenas Horários futuros ficam Disponíveis.
              </p>
            ) : null}

            {slotError ? (
              <p className="mt-3 rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {slotError}
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {loadingSlots ? (
                <p className="col-span-full text-sm text-[#c6d1ef]">Buscando Horários...</p>
              ) : slots.length > 0 ? (
                slots.map((slot) => (
                  <button
                    key={slot.startAt}
                    type="button"
                    onClick={() => {
                      setSelectedSlot(slot)
                      setStep("confirm")
                    }}
                    className="rounded-md border border-white/14 bg-[#0d1a45]/70 px-2 py-1.5 text-sm font-semibold text-[#e8eeff] transition hover:border-[#f36c20]/55 hover:bg-[#f36c20]/15"
                  >
                    {slot.time}
                  </button>
                ))
              ) : (
                <div className="col-span-full space-y-2">
                  <p className="text-sm text-[#c6d1ef]">
                    Nenhum Horário livre para esta data.
                  </p>
                  <UIButton
                    type="button"
                    variant="secondary"
                    className="!w-auto !px-3 !py-1.5 !text-xs"
                    disabled={findingNextSlots}
                    onClick={() => {
                      void findNextAvailableDate()
                    }}
                  >
                    {findingNextSlots ? "Buscando..." : "Buscar próxima data com Horários"}
                  </UIButton>
                </div>
              )}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setStep("barber")}
                className="text-sm text-[#b8c5ea] hover:text-white"
              >
                Voltar para barbeiros
              </button>
            </div>
          </section>
        ) : null}

        {step === "confirm" ? (
          <section className="mt-5 rounded-2xl border border-white/12 bg-[#0b1330]/84 p-4 md:p-5">
            <h2 className="text-lg font-semibold">Confirmar agendamento</h2>

            <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-[#0a112c]/70 p-3 text-sm">
              <p><span className="text-[#aeb8db]">Barbearia:</span> {shop?.name}</p>
              <p><span className="text-[#aeb8db]">Serviço:</span> {selectedService?.name}</p>
              <p><span className="text-[#aeb8db]">duração:</span> {selectedService?.durationMinutes} min</p>
              <p><span className="text-[#aeb8db]">Serviço:</span> {selectedPricing ? formatCurrency(selectedPricing.servicePriceCents) : "-"}</p>
              <p><span className="text-[#aeb8db]">Taxa de Serviço:</span> {selectedPricing ? formatCurrency(selectedPricing.serviceFeeCents) : "-"}</p>
              <p><span className="text-[#aeb8db]">Total:</span> {selectedPricing ? formatCurrency(selectedPricing.totalPriceCents) : "-"}</p>
              <p><span className="text-[#aeb8db]">Barbeiro:</span> {selectedBarber?.name}</p>
              <p><span className="text-[#aeb8db]">Data e hora:</span> {selectedSlot ? formatDateTime(selectedSlot.startAt) : "-"}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <UIButton
                type="button"
                disabled={creating || !selectedSlot}
                onClick={onCreateAppointment}
                className="!w-auto !px-5 !py-2 !text-sm"
              >
                {creating ? "Confirmando..." : "Confirmar agendamento"}
              </UIButton>
              <button
                type="button"
                onClick={() => setStep("slot")}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-[#d8e3ff] hover:bg-white/10"
              >
                Voltar para Horários
              </button>
            </div>
          </section>
        ) : null}

        {step === "done" ? (
          <section className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4 md:p-5">
            <h2 className="text-lg font-semibold text-emerald-100">Agendamento enviado</h2>
            <p className="mt-2 text-sm text-emerald-50">
              Aguardando confirmação do barbeiro.
            </p>
            {createdAppointment ? (
              <p className="mt-2 text-sm text-emerald-50">
                Horário: {formatDateTime(createdAppointment.startAt)}
              </p>
            ) : null}

            {shouldShowWhatsappReminder ? (
              <div className="mt-4 rounded-2xl border border-white/15 bg-[#0b1330]/85 p-4">
                <h3 className="text-base font-semibold text-[#f4f6ff]">
                  Notifique-me sobre o compromisso
                </h3>
                <p className="mt-1 text-sm text-[#c6d1ef]">
                  O WhatsApp será usado apenas para lembretes e atualizações deste compromisso.
                </p>
                <UIButton
                  type="button"
                  className="mt-3 !w-auto !px-4 !py-2 !text-sm"
                  onClick={handleWhatsappReminder}
                >
                  Ativar lembretes no WhatsApp
                </UIButton>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <UIButton
                type="button"
                variant="secondary"
                disabled={backCountdown > 0}
                className="!w-auto !px-4 !py-2 !text-sm disabled:cursor-not-allowed disabled:opacity-70"
                onClick={() => {
                  if (backCountdown > 0) return
                  router.push(`/barbearias/${slug}`)
                }}
              >
                {backCountdown > 0
                  ? `Voltar para barbearia (${backCountdown}s)`
                  : "Voltar para barbearia"}
              </UIButton>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}
