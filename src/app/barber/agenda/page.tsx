"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BarberGate } from "@/components/barber/BarberGate"
import { BarberShell } from "@/components/barber/BarberShell"
import { UIButton } from "@/components/ui/UIButton"
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

type AgendaTab = "upcoming" | "history"

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

function resolveError(result: ApiFailure, fallback: string) {
  return result.errors?.[0]?.message ?? result.message ?? fallback
}

export default function BarberAgendaPage() {
  const {
    state,
    error: accessError,
    token,
    barbershopStatus,
  } = useBarberAccess()

  const [activeTab, setActiveTab] = useState<AgendaTab>("upcoming")
  const [selectedDate, setSelectedDate] = useState(getBusinessDateToday())
  const [upcoming, setUpcoming] = useState<AppointmentItem[]>([])
  const [history, setHistory] = useState<AppointmentItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadAgenda = useCallback(async () => {
    if (!token) return

    setError(null)
    setLoading(true)

    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [upcomingResponse, historyResponse] = await Promise.all([
        fetch(`/api/barbers/me/appointments/pending?status=CONFIRMED&date=${selectedDate}&limit=200`, {
          headers,
          cache: "no-store",
        }),
        fetch(`/api/barbers/me/appointments/pending?status=CANCELED,REJECTED&date=${selectedDate}&limit=200`, {
          headers,
          cache: "no-store",
        }),
      ])

      const [upcomingResult, historyResult] = await Promise.all([
        upcomingResponse.json() as Promise<ApiResult<AppointmentListData>>,
        historyResponse.json() as Promise<ApiResult<AppointmentListData>>,
      ])

      if (!upcomingResult.success) {
        setError(resolveError(upcomingResult, "Falha ao carregar Próximos."))
        return
      }

      if (!historyResult.success) {
        setError(resolveError(historyResult, "Falha ao carregar historico."))
        return
      }

      const now = Date.now()
      setUpcoming(
        upcomingResult.data.items.filter((item) => new Date(item.startAt).getTime() >= now)
      )
      setHistory(historyResult.data.items)
    } catch {
      setError("Falha de conexão ao carregar agenda.")
    } finally {
      setLoading(false)
    }
  }, [selectedDate, token])

  useEffect(() => {
    if (state !== "ready") return
    const timer = window.setTimeout(() => {
      void loadAgenda()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [state, loadAgenda])

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "full",
        timeZone: "America/Sao_Paulo",
      }).format(new Date()),
    []
  )

  if (state !== "ready") {
    return (
      <BarberShell
        title="Minha Agenda"
        subtitle="Controle seus atendimentos por data."
        activePath="/barber/agenda"
        statusLabel={barbershopStatus}
      >
        <BarberGate state={state} error={accessError} />
      </BarberShell>
    )
  }

  return (
    <BarberShell
      title="Minha Agenda"
      subtitle={todayLabel}
      activePath="/barber/agenda"
      statusLabel={barbershopStatus}
    >
      {error ? (
        <p className="rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <section className="mt-4 rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <label className="block max-w-xs">
            <span className="mb-1 block text-sm text-[#aeb8db]">Calendario mensal</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
            />
          </label>
          <UIButton
            type="button"
            variant="secondary"
            className="!w-auto !px-4 !py-1.5 !text-sm"
            onClick={loadAgenda}
            disabled={loading}
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </UIButton>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl border border-white/12 bg-[#091029]/85 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Próximos</p>
            <p className="mt-1 text-2xl font-bold">{upcoming.length}</p>
          </article>
          <article className="rounded-xl border border-white/12 bg-[#091029]/85 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Concluidos</p>
            <p className="mt-1 text-2xl font-bold">--</p>
            <p className="mt-1 text-xs text-[#9eabd4]">Status COMPLETED ainda não habilitado.</p>
          </article>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
        <div className="flex gap-2 border-b border-white/10 pb-3">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              activeTab === "upcoming"
                ? "bg-[#f36c20]/20 text-[#ffe4d6]"
                : "text-[#c7d2f4] hover:bg-white/8"
            }`}
            onClick={() => setActiveTab("upcoming")}
          >
            Próximos
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              activeTab === "history"
                ? "bg-[#f36c20]/20 text-[#ffe4d6]"
                : "text-[#c7d2f4] hover:bg-white/8"
            }`}
            onClick={() => setActiveTab("history")}
          >
            Historico
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {activeTab === "upcoming" ? (
            upcoming.length > 0 ? (
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
                Nenhum atendimento Próximo para a data selecionada.
              </p>
            )
          ) : history.length > 0 ? (
            history.map((item) => (
              <article key={item.id} className="rounded-xl border border-white/12 bg-[#091029]/90 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-[#a7b1d0]">{item.barbershop.name}</p>
                  <span className="rounded-full border border-white/18 px-2 py-0.5 text-xs text-[#c6d1ef]">
                    {item.status}
                  </span>
                </div>
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
              Historico vazio para a data selecionada. Concluidos ficarao Disponíveis quando o status COMPLETED for adicionado.
            </p>
          )}
        </div>
      </section>
    </BarberShell>
  )
}

