"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { BarberGate } from "@/components/barber/BarberGate"
import { BarberShell } from "@/components/barber/BarberShell"
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
  const [loadingData, setLoadingData] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [swipeValues, setSwipeValues] = useState<Record<string, number>>({})

  const loadDashboard = useCallback(async () => {
    if (!token) return

    setError(null)
    setLoadingData(true)

    try {
      const today = getBusinessDateToday()
      const nowIso = new Date().toISOString()
      const headers = { Authorization: `Bearer ${token}` }

      const [pendingResponse, upcomingResponse, todayResponse, clientsResponse] =
        await Promise.all([
          fetch("/api/barbers/me/appointments/pending?status=PENDING&limit=80", {
            headers,
            cache: "no-store",
          }),
          fetch(`/api/barbers/me/appointments/pending?status=CONFIRMED&from=${encodeURIComponent(nowIso)}&limit=12`, {
            headers,
            cache: "no-store",
          }),
          fetch(`/api/barbers/me/appointments/pending?status=CONFIRMED&date=${today}&limit=200`, {
            headers,
            cache: "no-store",
          }),
          fetch("/api/barbers/me/appointments/pending?status=CONFIRMED&limit=300", {
            headers,
            cache: "no-store",
          }),
        ])

      const [pendingResult, upcomingResult, todayResult, clientsResult] =
        await Promise.all([
          pendingResponse.json() as Promise<ApiResult<AppointmentListData>>,
          upcomingResponse.json() as Promise<ApiResult<AppointmentListData>>,
          todayResponse.json() as Promise<ApiResult<AppointmentListData>>,
          clientsResponse.json() as Promise<ApiResult<AppointmentListData>>,
        ])

      if (!pendingResult.success) {
        if (pendingResult.code === "UNAUTHORIZED") {
          clearAccessToken()
        }
        setError(resolveError(pendingResult, "Falha ao carregar pendentes."))
        return
      }

      if (!upcomingResult.success) {
        setError(resolveError(upcomingResult, "Falha ao carregar proximos atendimentos."))
        return
      }

      if (!todayResult.success) {
        setError(resolveError(todayResult, "Falha ao carregar metricas de hoje."))
        return
      }

      if (!clientsResult.success) {
        setError(resolveError(clientsResult, "Falha ao carregar total de clientes."))
        return
      }

      setPending(pendingResult.data.items)
      setUpcoming(upcomingResult.data.items)
      setTodayConfirmedCount(todayResult.data.items.length)
      setTotalClients(new Set(clientsResult.data.items.map((item) => item.clientUser.id)).size)
      setSwipeValues({})
    } catch {
      setError("Falha de conexao ao carregar o dashboard do barbeiro.")
    } finally {
      setLoadingData(false)
    }
  }, [token])

  useEffect(() => {
    if (state !== "ready") return
    const timer = window.setTimeout(() => {
      void loadDashboard()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [state, loadDashboard])

  async function handleAction(item: AppointmentItem, action: "confirm" | "reject") {
    if (!token) return
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
        return
      }

      setPending((prev) => prev.filter((appointment) => appointment.id !== item.id))
      setSwipeValues((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })

      if (action === "confirm" && new Date(item.startAt).getTime() > Date.now()) {
        const confirmedItem: AppointmentItem = { ...item, status: "CONFIRMED" }
        setUpcoming((prev) =>
          [...prev, confirmedItem].sort(
            (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
          )
        )
        setTodayConfirmedCount((prev) => prev + 1)
      }
    } catch {
      setError("Falha de conexao ao atualizar agendamento.")
    } finally {
      setProcessingId(null)
    }
  }

  function onSwipeChange(appointmentId: string, value: number) {
    setSwipeValues((prev) => ({ ...prev, [appointmentId]: value }))
  }

  function onSwipeCommit(item: AppointmentItem) {
    const value = swipeValues[item.id] ?? 0
    if (value >= 90) {
      void handleAction(item, "confirm")
      return
    }
    setSwipeValues((prev) => ({ ...prev, [item.id]: 0 }))
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
      label: "Avaliacao",
      value: "--",
      hint: "Em breve",
    },
  ], [todayConfirmedCount, totalClients])

  if (state !== "ready") {
    return (
      <BarberShell
        title="Dashboard do barbeiro"
        subtitle="Resumo rapido da operacao e proximos atendimentos."
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
      subtitle="Confirme agendamentos pendentes e acompanhe os proximos atendimentos."
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
          <h2 className="text-lg font-semibold">Pendentes para confirmacao</h2>
          <UIButton
            type="button"
            variant="secondary"
            className="!w-auto !px-4 !py-1.5 !text-sm"
            onClick={loadDashboard}
            disabled={loadingData}
          >
            {loadingData ? "Atualizando..." : "Atualizar"}
          </UIButton>
        </div>

        <div className="mt-4 grid gap-3">
          {pending.length > 0 ? (
            pending.map((item) => {
              const currentSwipe = swipeValues[item.id] ?? 0
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
                    Duracao/valor: {item.service.durationMinutes} min - {formatCurrency(item.service.priceCents)}
                  </p>

                  <div className="mt-3 rounded-xl border border-[#f36c20]/35 bg-[#f36c20]/8 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#ffd8c2]">
                        Deslize para confirmar
                      </span>
                      <span className="text-xs text-[#ffd8c2]">{Math.round(currentSwipe)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={currentSwipe}
                      disabled={isProcessing}
                      onChange={(event) => onSwipeChange(item.id, Number(event.target.value))}
                      onMouseUp={() => onSwipeCommit(item)}
                      onTouchEnd={() => onSwipeCommit(item)}
                      className="mt-2 h-2 w-full cursor-pointer accent-[#f36c20]"
                    />
                  </div>

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
          <h2 className="text-lg font-semibold">Proximos atendimentos</h2>
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
              Nenhum agendamento proximo no momento.
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
