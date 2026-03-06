"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { PremiumBackground } from "@/components/background"
import { SwipeConfirm } from "@/components/ui/SwipeConfirm"
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

type AppointmentItem = {
  id: string
  barbershopId: string
  serviceId: string
  barberUserId: string
  startAt: string
  endAt: string
  status: "PENDING" | "CONFIRMED" | "CANCELED" | "REJECTED" | "COMPLETED"
  displayStatus: "PENDING" | "CONFIRMED" | "CANCELED" | "REJECTED" | "COMPLETED"
  canCancel: boolean
  latestCancelableAt: string
  isUpcoming: boolean
  servicePriceCents: number
  serviceFeeCents: number
  totalPriceCents: number
  barbershop: {
    id: string
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
  barberUser: {
    id: string
    name: string
  }
}

type AppointmentsData = {
  view: "upcoming" | "past" | "all"
  count: number
  items: AppointmentItem[]
}

type ScreenState = "loading" | "unauthenticated" | "ready"
type AgendaTab = "upcoming" | "past"

function resolveErrorMessage(result: ApiFailure) {
  return result.errors?.[0]?.message ?? result.message
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

function mapStatusLabel(status: AppointmentItem["displayStatus"]) {
  if (status === "PENDING") return "Pendente"
  if (status === "CONFIRMED") return "Confirmado"
  if (status === "CANCELED") return "Cancelado"
  if (status === "REJECTED") return "Recusado"
  return "Concluído"
}

function statusClass(status: AppointmentItem["displayStatus"]) {
  if (status === "CONFIRMED") {
    return "border-emerald-300/35 bg-emerald-500/12 text-emerald-100"
  }
  if (status === "PENDING") {
    return "border-amber-300/35 bg-amber-500/12 text-amber-100"
  }
  if (status === "COMPLETED") {
    return "border-blue-300/35 bg-blue-500/12 text-blue-100"
  }
  return "border-white/15 bg-[#131d45] text-[#ced8fa]"
}

export default function ClienteAgendamentosPage() {
  const [screen, setScreen] = useState<ScreenState>("loading")
  const [tab, setTab] = useState<AgendaTab>("upcoming")
  const [items, setItems] = useState<AppointmentItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadingItems, setLoadingItems] = useState(false)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [pendingCancelConfirmId, setPendingCancelConfirmId] = useState<string | null>(null)
  const [cancelSwipeKeys, setCancelSwipeKeys] = useState<Record<string, number>>({})

  const loadAppointments = useCallback(async (nextTab: AgendaTab) => {
    const token = getAccessToken()
    if (!token) {
      setScreen("unauthenticated")
      return
    }

    setLoadingItems(true)
    setError(null)

    try {
      const response = await fetch(`/api/appointments/my?view=${nextTab}&limit=150`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      })

      const result = (await response.json()) as ApiResult<AppointmentsData>
      if (!result.success) {
        setError(resolveErrorMessage(result))
        return
      }

      setItems(result.data.items)
      setScreen("ready")

      setPendingCancelConfirmId((current) =>
        current && result.data.items.some((item) => item.id === current) ? current : null
      )
    } catch {
      setError("Falha de conexão ao carregar seus agendamentos.")
    } finally {
      setLoadingItems(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAppointments(tab)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadAppointments, tab])

  const hasItems = useMemo(() => items.length > 0, [items])

  async function cancelAppointment(appointmentId: string) {
    const token = getAccessToken()
    if (!token) {
      setScreen("unauthenticated")
      return
    }

    setCancelingId(appointmentId)
    setError(null)

    try {
      const response = await fetch(`/api/appointments/${appointmentId}/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      })

      const result = (await response.json()) as ApiResult<{ id: string }>
      if (!result.success) {
        setError(resolveErrorMessage(result))
        return
      }

      setPendingCancelConfirmId(null)
      await loadAppointments(tab)
    } catch {
      setError("Falha de conexão ao cancelar agendamento.")
    } finally {
      setCancelingId(null)
    }
  }

  function resetCancelSwipe(appointmentId: string) {
    setCancelSwipeKeys((prev) => ({
      ...prev,
      [appointmentId]: (prev[appointmentId] ?? 0) + 1,
    }))
  }

  function armCancellation(appointmentId: string) {
    setPendingCancelConfirmId(appointmentId)
    return true
  }

  if (screen === "unauthenticated") {
    return (
      <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
        <PremiumBackground />
        <section className="relative z-10 mx-auto max-w-3xl rounded-3xl border border-white/10 bg-[#0d1434]/80 p-6 text-center">
          <p className="text-[#d0d7ef]">Você precisa fazer login para acessar seus agendamentos.</p>
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
            <h1 className="text-3xl font-bold">Meus agendamentos</h1>
            <p className="mt-1 text-sm text-[#a7b1d0] md:text-base">
              Acompanhe seus Próximos atendimentos e historico.
            </p>
          </div>
          <UIButton
            type="button"
            variant="secondary"
            className="!w-auto !px-4 !py-2 !text-sm"
            onClick={() => void loadAppointments(tab)}
            disabled={loadingItems}
          >
            {loadingItems ? "Atualizando..." : "Atualizar"}
          </UIButton>
        </div>

        <div className="mt-4 inline-flex rounded-xl border border-white/12 bg-[#0b1330]/85 p-1">
          <button
            type="button"
            onClick={() => setTab("upcoming")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === "upcoming"
                ? "bg-[#f36c20]/22 text-[#ffd8c2]"
                : "text-[#b7c3e7] hover:bg-white/5"
            }`}
          >
            Próximos
          </button>
          <button
            type="button"
            onClick={() => setTab("past")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === "past"
                ? "bg-[#f36c20]/22 text-[#ffd8c2]"
                : "text-[#b7c3e7] hover:bg-white/5"
            }`}
          >
            Historico
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        {loadingItems && !hasItems ? (
          <div className="mt-6 grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <article key={index} className="animate-pulse rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
                <div className="h-5 w-1/3 rounded bg-white/10" />
                <div className="mt-2 h-4 w-2/3 rounded bg-white/10" />
                <div className="mt-2 h-4 w-1/2 rounded bg-white/10" />
              </article>
            ))}
          </div>
        ) : !hasItems ? (
          <div className="mt-6 rounded-2xl border border-white/12 bg-[#0b1330]/80 p-5">
            <p className="text-base font-semibold text-[#dbe4ff]">
              {tab === "upcoming" ? "Nenhum agendamento Próximo." : "Nenhum agendamento no historico."}
            </p>
            {tab === "upcoming" ? (
              <UIButton href="/cliente/barbearias-proximas" className="mt-4 !w-auto !px-4 !py-2 !text-sm">
                Agendar agora
              </UIButton>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {item.barbershop.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.barbershop.logoUrl}
                        alt={`Logo ${item.barbershop.name}`}
                        className="h-9 w-9 rounded-lg border border-white/15 object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-[#111c47] text-[10px] font-semibold text-[#d7e1ff]">
                        {item.barbershop.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <p className="text-sm text-[#a7b1d0]">{item.barbershop.name}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(item.displayStatus)}`}>
                    {mapStatusLabel(item.displayStatus)}
                  </span>
                </div>

                <h3 className="mt-1 text-lg font-semibold">{item.service.name}</h3>
                <p className="mt-1 text-sm text-[#d2daf3]">
                  Barbeiro: <span className="font-semibold">{item.barberUser.name}</span>
                </p>
                <p className="text-sm text-[#d2daf3]">
                  Data/hora: <span className="font-semibold">{formatDateTime(item.startAt)}</span>
                </p>
                <p className="text-sm text-[#d2daf3]">
                  duração/serviço: {item.service.durationMinutes} min - {formatCurrency(item.servicePriceCents)}
                </p>
                <p className="text-sm text-[#d2daf3]">
                  Taxa/total: {formatCurrency(item.serviceFeeCents)} - {formatCurrency(item.totalPriceCents)}
                </p>

                {tab === "upcoming" ? (
                  <div className="mt-3">
                    {item.canCancel ? (
                      pendingCancelConfirmId === item.id ? (
                        <div className="rounded-xl border border-[#f36c20]/35 bg-[#f36c20]/10 p-3">
                          <p className="text-sm text-[#ffe2d2]">
                            Confirmar cancelamento deste agendamento?
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void cancelAppointment(item.id)}
                              disabled={cancelingId === item.id}
                              className="rounded-lg border border-[#ff965f]/30 bg-gradient-to-b from-[#f36c20] via-[#e0531e] to-[#cb4518] px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {cancelingId === item.id ? "Cancelando..." : "Confirmar cancelamento"}
                            </button>
                            <button
                              type="button"
                              disabled={cancelingId === item.id}
                              onClick={() => {
                                setPendingCancelConfirmId(null)
                                resetCancelSwipe(item.id)
                              }}
                              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-[#d8e3ff] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              Voltar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <SwipeConfirm
                          key={`${item.id}-${cancelSwipeKeys[item.id] ?? 0}`}
                          className="max-w-[360px]"
                          disabled={cancelingId === item.id}
                          label="Deslize para cancelar"
                          confirmedLabel="Pronto para cancelar"
                          onConfirm={() => armCancellation(item.id)}
                        />
                      )
                    ) : (
                      <span
                        title="Você só pode cancelar até 30 minutos antes."
                        className="inline-flex rounded-lg border border-white/15 bg-[#111c47] px-3 py-1.5 text-xs font-semibold text-[#9fb0dd]"
                      >
                        Você só pode cancelar até 30 minutos antes.
                      </span>
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
