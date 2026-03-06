"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BarberGate } from "@/components/barber/BarberGate"
import { BarberShell } from "@/components/barber/BarberShell"
import { SwipeConfirm } from "@/components/ui/SwipeConfirm"
import { UIButton } from "@/components/ui/UIButton"
import { clearAccessToken } from "@/lib/client/session"
import { useBarberAccess } from "@/lib/client/use-barber-access"

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

type AppointmentItem = {
  id: string
  barbershopId: string
  startAt: string
  endAt: string
  status: "PENDING" | "CONFIRMED" | "CANCELED" | "REJECTED"
  clientUser: {
    id: string
    name: string
  }
  barbershop: {
    name: string
    slug: string | null
    logoUrl: string | null
  }
  service: {
    id: string
    name: string
    durationMinutes: number
    priceCents: number
  }
}

type AppointmentListData = {
  count: number
  items: AppointmentItem[]
}

const POLL_VISIBLE_MS = 5000
const POLL_HIDDEN_MS = 30000

function getBusinessDateToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value))
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function resolveError(result: ApiFailure, fallback: string) {
  return result.errors?.[0]?.message ?? result.message ?? fallback
}

export default function BarberDashboardPage() {
  const pathname = usePathname()
  const {
    state,
    error: accessError,
    token,
    userName,
    barbershopStatus,
  } = useBarberAccess()

  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<AppointmentItem[]>([])
  const [upcoming, setUpcoming] = useState<AppointmentItem[]>([])
  const [todayConfirmedCount, setTodayConfirmedCount] = useState(0)
  const [totalClients, setTotalClients] = useState(0)
  const [loadingSections, setLoadingSections] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const pollingInFlightRef = useRef(false)

  const loadPendingAndUpcoming = useCallback(async (options?: { silent?: boolean }) => {
    if (!token) return
    const silent = options?.silent ?? false

    if (!silent) {
      setError(null)
      setLoadingSections(true)
    }

    try {
      const nowIso = new Date().toISOString()
      const headers = { Authorization: `Bearer ${token}` }

      const [pendingResponse, upcomingResponse] = await Promise.all([
        fetch("/api/barbers/me/appointments/pending?status=PENDING&limit=20", {
          headers,
          cache: "no-store",
        }),
        fetch(`/api/barbers/me/appointments/pending?status=CONFIRMED&from=${encodeURIComponent(nowIso)}&limit=20`, {
          headers,
          cache: "no-store",
        }),
      ])

      const [pendingResult, upcomingResult] = await Promise.all([
        pendingResponse.json() as Promise<ApiResult<AppointmentListData>>,
        upcomingResponse.json() as Promise<ApiResult<AppointmentListData>>,
      ])

      if (!pendingResult.success) {
        if (pendingResult.code === "UNAUTHORIZED") {
          clearAccessToken()
        }
        if (!silent) {
          setError(resolveError(pendingResult, "Falha ao carregar pendentes."))
        }
        return
      }

      if (!upcomingResult.success) {
        if (!silent) {
          setError(resolveError(upcomingResult, "Falha ao carregar Próximos atendimentos."))
        }
        return
      }

      setPending(pendingResult.data.items)
      setUpcoming(upcomingResult.data.items)
    } catch {
      if (!silent) {
        setError("Falha de conexão ao carregar o dashboard do barbeiro.")
      }
    } finally {
      if (!silent) {
        setLoadingSections(false)
      }
    }
  }, [token])

  const loadMetrics = useCallback(async () => {
    if (!token) return

    try {
      const today = getBusinessDateToday()
      const headers = { Authorization: `Bearer ${token}` }

      const [todayResponse, clientsResponse] = await Promise.all([
        fetch(`/api/barbers/me/appointments/pending?status=CONFIRMED&date=${today}&limit=200`, {
          headers,
          cache: "no-store",
        }),
        fetch("/api/barbers/me/appointments/pending?status=CONFIRMED&limit=300", {
          headers,
          cache: "no-store",
        }),
      ])

      const [todayResult, clientsResult] = await Promise.all([
        todayResponse.json() as Promise<ApiResult<AppointmentListData>>,
        clientsResponse.json() as Promise<ApiResult<AppointmentListData>>,
      ])

      if (!todayResult.success) return
      if (!clientsResult.success) return

      setTodayConfirmedCount(todayResult.data.items.length)
      setTotalClients(new Set(clientsResult.data.items.map((item) => item.clientUser.id)).size)
    } catch {
      // Mantem silencioso para não poluir UX com erro fora das secoes de polling.
    }
  }, [token])

  useEffect(() => {
    if (state !== "ready") return
    const timer = window.setTimeout(() => {
      void loadPendingAndUpcoming()
      void loadMetrics()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [state, loadMetrics, loadPendingAndUpcoming])

  useEffect(() => {
    const isBarberPollingRoute = pathname === "/barber/dashboard" || pathname === "/barber/agenda"
    if (state !== "ready" || !token || !isBarberPollingRoute) {
      return
    }

    let timeoutId: number | null = null
    let cancelled = false

    const runPollingRevalidation = async () => {
      if (cancelled || pollingInFlightRef.current) return
      pollingInFlightRef.current = true
      try {
        await loadPendingAndUpcoming({ silent: true })
      } finally {
        pollingInFlightRef.current = false
      }
    }

    const scheduleNext = () => {
      if (cancelled) return
      const delay = document.visibilityState === "visible" ? POLL_VISIBLE_MS : POLL_HIDDEN_MS
      timeoutId = window.setTimeout(async () => {
        await runPollingRevalidation()
        scheduleNext()
      }, delay)
    }

    const revalidateNow = async () => {
      if (cancelled) return
      if (timeoutId) {
        window.clearTimeout(timeoutId)
        timeoutId = null
      }
      await runPollingRevalidation()
      scheduleNext()
    }

    scheduleNext()
    const onVisibilityChange = () => {
      void revalidateNow()
    }
    const onWindowFocus = () => {
      void revalidateNow()
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("focus", onWindowFocus)

    return () => {
      cancelled = true
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("focus", onWindowFocus)
    }
  }, [loadPendingAndUpcoming, pathname, state, token])

  async function handleAction(item: AppointmentItem, action: "confirm" | "reject") {
    if (!token) return false
    setProcessingId(item.id)
    setError(null)

    try {
      const endpoint =
        action === "confirm"
          ? `/api/barbershops/${item.barbershopId}/appointments/${item.id}/confirm`
          : `/api/barbershops/${item.barbershopId}/appointments/${item.id}/reject`

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = (await response.json()) as ApiResult<{ id: string }>
      if (!result.success) {
        setError(resolveError(result, "Falha ao atualizar agendamento."))
        return false
      }

      setPending((prev) => prev.filter((appointment) => appointment.id !== item.id))

      if (action === "confirm" && new Date(item.startAt).getTime() > Date.now()) {
        const confirmedItem: AppointmentItem = { ...item, status: "CONFIRMED" }
        setUpcoming((prev) =>
          [...prev, confirmedItem].sort(
            (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
          )
        )
        setTodayConfirmedCount((prev) => prev + 1)
      }

      return true
    } catch {
      setError("Falha de conexão ao atualizar agendamento.")
      return false
    } finally {
      setProcessingId(null)
    }
  }

  const metricCards = useMemo(() => [
    {
      label: "Agendamentos hoje",
      value: String(todayConfirmedCount),
      hint: "Confirmados para hoje",
    },
    {
      label: "Clientes",
      value: String(totalClients),
      hint: "Qtd de clientes agendados",
    },
    {
      label: "Ganhos",
      value: "R$ --",
      hint: "Em breve",
    },
    {
      label: "Avaliação",
      value: "--",
      hint: "Em breve",
    },
  ], [todayConfirmedCount, totalClients])

  if (state !== "ready") {
    return (
      <BarberShell
        title="Dashboard do barbeiro"
        subtitle="Resumo rápido da operação e Próximos atendimentos."
        activePath="/barber/dashboard"
        statusLabel={barbershopStatus}
      >
        <BarberGate state={state} error={accessError} />
      </BarberShell>
    )
  }

  return (
    <BarberShell
      title={`Dashboard ${userName ? `- ${userName}` : "do barbeiro"}`}
      subtitle="Confirme agendamentos pendentes e acompanhe os Próximos atendimentos."
      activePath="/barber/dashboard"
      statusLabel={barbershopStatus}
    >
      {error ? (
        <p className="rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <article key={card.label} className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">{card.label}</p>
            <p className="mt-1 text-2xl font-bold">{card.value}</p>
            <p className="mt-1 text-xs text-[#9eabd4]">{card.hint}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-white/12 bg-[#0b1330]/82 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Pendentes para Confirmação</h2>
          <UIButton
            type="button"
            variant="secondary"
            className="!w-auto !px-4 !py-1.5 !text-sm"
            onClick={() => {
              void loadPendingAndUpcoming()
            }}
            disabled={loadingSections}
          >
            {loadingSections ? "Atualizando..." : "Atualizar"}
          </UIButton>
        </div>

        <div className="mt-4 grid gap-3">
          {pending.length > 0 ? (
            pending.map((item) => {
              const isProcessing = processingId === item.id

              return (
                <article key={item.id} className="rounded-xl border border-white/12 bg-[#091029]/90 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-[#a7b1d0]">{item.barbershop.name}</p>
                    <span className="rounded-full border border-amber-300/35 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-100">
                      Pendente
                    </span>
                  </div>

                  <h3 className="mt-1 text-lg font-semibold">{item.service.name}</h3>
                  <p className="mt-1 text-sm text-[#d2daf3]">
                    Cliente: <span className="font-semibold">{item.clientUser.name}</span>
                  </p>
                  <p className="text-sm text-[#d2daf3]">
                    Data/hora: <span className="font-semibold">{formatDateTime(item.startAt)}</span>
                  </p>
                  <p className="text-sm text-[#d2daf3]">
                    duração/valor: {item.service.durationMinutes} min - {formatCurrency(item.service.priceCents)}
                  </p>

                  <SwipeConfirm
                    className="mt-3"
                    disabled={isProcessing}
                    onConfirm={() => handleAction(item, "confirm")}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => void handleAction(item, "reject")}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-[#d8e3ff] transition hover:bg-white/10 disabled:opacity-60"
                    >
                      {isProcessing ? "Processando..." : "Recusar"}
                    </button>
                  </div>
                </article>
              )
            })
          ) : (
            <p className="rounded-xl border border-white/10 bg-[#0a122f]/70 p-4 text-sm text-[#c6d1ef]">
              Nenhum agendamento pendente no momento.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/12 bg-[#0b1330]/82 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Próximos atendimentos</h2>
          <UIButton href="/barber/agenda" variant="secondary" className="!w-auto !px-4 !py-1.5 !text-sm">
            Ver Agenda
          </UIButton>
        </div>

        <div className="mt-4 grid gap-3">
          {upcoming.length > 0 ? (
            upcoming.map((item) => (
              <article key={item.id} className="rounded-xl border border-white/12 bg-[#091029]/90 p-4">
                <p className="text-sm text-[#a7b1d0]">{item.barbershop.name}</p>
                <h3 className="mt-1 text-lg font-semibold">{item.service.name}</h3>
                <p className="mt-1 text-sm text-[#d2daf3]">
                  Cliente: <span className="font-semibold">{item.clientUser.name}</span>
                </p>
                <p className="text-sm text-[#d2daf3]">
                  Data/hora: <span className="font-semibold">{formatDateTime(item.startAt)}</span>
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-white/10 bg-[#0a122f]/70 p-4 text-sm text-[#c6d1ef]">
              Nenhum agendamento Próximo no momento.
            </p>
          )}
        </div>

        <div className="mt-4">
          <Link
            href="/barber/agenda"
            className="text-sm font-semibold text-[#dbe4ff] underline-offset-4 hover:underline"
          >
            Ir para agenda completa
          </Link>
        </div>
      </section>
    </BarberShell>
  )
}
