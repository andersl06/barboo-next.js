"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { OwnerGate } from "@/components/owner/OwnerGate"
import { OwnerShell } from "@/components/owner/OwnerShell"
import { UIButton } from "@/components/ui/UIButton"
import { useOwnerAccess } from "@/lib/client/use-owner-access"

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

type FinanceSummaryData = {
  month: string
  monthlyAppointmentsCount: number
  monthlyServiceAmountCents: number
  monthlyTotalAmountCents: number
  financialStatus: "ACTIVE" | "BLOCKED"
  blockedReason: string | null
  blockedAt: string | null
}

type InvoiceAppointmentItem = {
  appointmentId: string
  appointment: {
    id: string
    startAt: string
    status: "PENDING" | "CONFIRMED" | "CANCELED" | "REJECTED" | "COMPLETED"
    servicePriceCents: number
    serviceFeeCents: number
    totalPriceCents: number
    service: {
      id: string
      name: string
    }
    barberUser: {
      id: string
      name: string
    }
    clientUser: {
      id: string
      name: string
    }
  }
}

type InvoiceItem = {
  id: string
  periodStart: string
  periodEnd: string
  dueAt: string
  status: "OPEN" | "PAID" | "OVERDUE" | "VOID"
  totalAppointments: number
  totalFeesCents: number
  paidAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  items: InvoiceAppointmentItem[]
}

type InvoicesData = {
  financialStatus: "ACTIVE" | "BLOCKED"
  blockedReason: string | null
  blockedAt: string | null
  count: number
  items: InvoiceItem[]
}

function resolveErrorMessage(result: ApiFailure, fallback: string) {
  return result.errors?.[0]?.message ?? result.message ?? fallback
}

function getBusinessMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date()).slice(0, 7)
}

function getBusinessDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value))
}

function statusBadgeClass(status: InvoiceItem["status"]) {
  if (status === "PAID") return "border-emerald-300/35 bg-emerald-500/12 text-emerald-100"
  if (status === "OVERDUE") return "border-red-300/35 bg-red-500/12 text-red-100"
  if (status === "VOID") return "border-white/20 bg-[#131d45] text-[#ced8fa]"
  return "border-amber-300/35 bg-amber-500/12 text-amber-100"
}

export default function OwnerFinancePage() {
  const {
    state,
    error: accessError,
    token,
    barbershopStatus,
  } = useOwnerAccess()

  const [month, setMonth] = useState(getBusinessMonth())
  const [weekDate, setWeekDate] = useState(getBusinessDate())
  const [summary, setSummary] = useState<FinanceSummaryData | null>(null)
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null)

  const loadFinanceData = useCallback(async () => {
    if (!token) return

    setLoading(true)
    setError(null)

    try {
      const headers = { Authorization: `Bearer ${token}` }

      const [summaryResponse, invoicesResponse] = await Promise.all([
        fetch(`/api/owner/finance/summary?month=${encodeURIComponent(month)}`, {
          headers,
          cache: "no-store",
        }),
        fetch("/api/owner/finance/invoices", {
          headers,
          cache: "no-store",
        }),
      ])

      const [summaryResult, invoicesResult] = await Promise.all([
        summaryResponse.json() as Promise<ApiResult<FinanceSummaryData>>,
        invoicesResponse.json() as Promise<ApiResult<InvoicesData>>,
      ])

      if (!summaryResult.success) {
        setError(resolveErrorMessage(summaryResult, "Falha ao carregar resumo financeiro."))
        return
      }

      if (!invoicesResult.success) {
        setError(resolveErrorMessage(invoicesResult, "Falha ao carregar faturas semanais."))
        return
      }

      setSummary(summaryResult.data)
      setInvoices(invoicesResult.data.items)
      setExpandedInvoiceId((current) =>
        current && invoicesResult.data.items.some((item) => item.id === current) ? current : null
      )
    } catch {
      setError("Falha de conexao ao carregar dados financeiros.")
    } finally {
      setLoading(false)
    }
  }, [month, token])

  useEffect(() => {
    if (state !== "ready") return
    const timer = window.setTimeout(() => {
      void loadFinanceData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [state, loadFinanceData])

  async function generateWeeklyInvoice() {
    if (!token) return

    setGenerating(true)
    setError(null)
    try {
      const response = await fetch(`/api/owner/finance/invoices/generate?week=${encodeURIComponent(weekDate)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = (await response.json()) as ApiResult<{ created: boolean }>
      if (!result.success) {
        setError(resolveErrorMessage(result, "Falha ao gerar fatura semanal."))
        return
      }

      await loadFinanceData()
    } catch {
      setError("Falha de conexao ao gerar fatura semanal.")
    } finally {
      setGenerating(false)
    }
  }

  async function markInvoiceAsPaid(invoiceId: string) {
    if (!token) return

    setMarkingPaidId(invoiceId)
    setError(null)
    try {
      const response = await fetch(`/api/owner/finance/invoices/${invoiceId}/mark-paid`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = (await response.json()) as ApiResult<{ invoice: { id: string } }>
      if (!result.success) {
        setError(resolveErrorMessage(result, "Falha ao marcar fatura como paga."))
        return
      }

      await loadFinanceData()
    } catch {
      setError("Falha de conexao ao atualizar a fatura.")
    } finally {
      setMarkingPaidId(null)
    }
  }

  const cards = useMemo(() => [
    {
      label: "Agendamentos no mes",
      value: summary ? String(summary.monthlyAppointmentsCount) : "--",
    },
    {
      label: "Valor do mes (servicos)",
      value: summary ? formatCurrency(summary.monthlyServiceAmountCents) : "--",
    },
    {
      label: "Valor total do mes (cliente)",
      value: summary ? formatCurrency(summary.monthlyTotalAmountCents) : "--",
    },
  ], [summary])

  if (state !== "ready") {
    return (
      <OwnerShell
        title="Financeiro"
        subtitle="Resumo mensal e faturas semanais da barbearia."
        activePath="/owner/finance"
        statusLabel={barbershopStatus}
      >
        <OwnerGate state={state} error={accessError} />
      </OwnerShell>
    )
  }

  return (
    <OwnerShell
      title="Financeiro"
      subtitle="Acompanhe valores do mes, faturas semanais e status financeiro da barbearia."
      activePath="/owner/finance"
      statusLabel={barbershopStatus}
    >
      {summary?.financialStatus === "BLOCKED" ? (
        <p className="rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
          Sua barbearia esta bloqueada por pendencia financeira. Regularize para voltar a receber agendamentos.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <section className="mt-4 rounded-2xl border border-white/12 bg-[#0b1330]/82 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Mes</span>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2 text-sm text-[#f4f6ff] outline-none transition focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
            />
          </label>

          <UIButton
            type="button"
            variant="secondary"
            className="!w-auto !px-4 !py-2 !text-sm"
            onClick={() => void loadFinanceData()}
            disabled={loading}
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </UIButton>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <article key={card.label} className="rounded-2xl border border-white/12 bg-[#091029]/90 p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">{card.label}</p>
              <p className="mt-1 text-2xl font-bold">{card.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/12 bg-[#0b1330]/82 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Faturas semanais</h2>
            <p className="mt-1 text-sm text-[#aeb8db]">
              Fechamento manual semanal do total de taxas cobradas.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Semana (data base)</span>
              <input
                type="date"
                value={weekDate}
                onChange={(event) => setWeekDate(event.target.value)}
                className="rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2 text-sm text-[#f4f6ff] outline-none transition focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
              />
            </label>
            <UIButton
              type="button"
              className="!w-auto !px-4 !py-2 !text-sm"
              onClick={() => void generateWeeklyInvoice()}
              disabled={generating}
            >
              {generating ? "Gerando..." : "Gerar fatura"}
            </UIButton>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {invoices.length > 0 ? (
            invoices.map((invoice) => {
              const isExpanded = expandedInvoiceId === invoice.id
              const isMarkingPaid = markingPaidId === invoice.id

              return (
                <article key={invoice.id} className="rounded-xl border border-white/12 bg-[#091029]/90 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#e7edff]">
                        Periodo: {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                      </p>
                      <p className="mt-1 text-xs text-[#aeb8db]">
                        Vencimento: {formatDateTime(invoice.dueAt)}
                      </p>
                      <p className="mt-1 text-xs text-[#c8d2f2]">
                        Agendamentos: {invoice.totalAppointments} | Taxas: {formatCurrency(invoice.totalFeesCents)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(invoice.status)}`}>
                        {invoice.status}
                      </span>
                      {(invoice.status === "OPEN" || invoice.status === "OVERDUE") ? (
                        <button
                          type="button"
                          onClick={() => void markInvoiceAsPaid(invoice.id)}
                          disabled={isMarkingPaid}
                          className="rounded-lg border border-emerald-300/35 bg-emerald-500/12 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-70"
                        >
                          {isMarkingPaid ? "Processando..." : "Marcar como pago"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.id)}
                        className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-[#d8e3ff] transition hover:bg-white/10"
                      >
                        {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                      </button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-[#0a122f]/75 p-3">
                      {invoice.items.length > 0 ? (
                        invoice.items.map((item) => (
                          <div
                            key={item.appointmentId}
                            className="rounded-lg border border-white/10 bg-[#0b1536]/80 p-3 text-sm"
                          >
                            <p className="font-semibold text-[#e7edff]">
                              {item.appointment.service.name}
                            </p>
                            <p className="mt-1 text-xs text-[#aeb8db]">
                              {formatDateTime(item.appointment.startAt)} | #{item.appointment.id.slice(0, 8)}
                            </p>
                            <p className="mt-1 text-xs text-[#c8d2f2]">
                              Taxa: {formatCurrency(item.appointment.serviceFeeCents)} | Servico: {formatCurrency(item.appointment.servicePriceCents)}
                            </p>
                            <p className="mt-1 text-xs text-[#c8d2f2]">
                              Cliente: {item.appointment.clientUser.name} | Barbeiro: {item.appointment.barberUser.name}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-[#c6d1ef]">Nenhum agendamento vinculado a esta fatura.</p>
                      )}
                    </div>
                  ) : null}
                </article>
              )
            })
          ) : (
            <p className="rounded-xl border border-white/10 bg-[#0a122f]/70 p-4 text-sm text-[#c6d1ef]">
              Nenhuma fatura semanal gerada ate o momento.
            </p>
          )}
        </div>
      </section>
    </OwnerShell>
  )
}

