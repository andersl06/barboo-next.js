
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChargeStatus } from "@/lib/billing/types"
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
  weeklyAppointmentsCount: number
  weeklyServiceAmountCents: number
  weeklyFeeAmountCents: number
  weeklyTotalAmountCents: number
  invoiceStatusTotals: {
    OPEN: number
    PAID: number
    OVERDUE: number
    VOID: number
  }
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

type PayInvoiceData = {
  invoiceId: string
  qrCodeImageUrl: string | null
  qrCodeCopyPaste: string
  pixCode?: string | null
  qrCodeBase64?: string | null
  ticketUrl?: string | null
  expiresAt: string | null
  amount?: number
  amountCents: number
  status: ChargeStatus
  reused: boolean
}

type ChargeStatusData = {
  invoiceId: string
  status: ChargeStatus
  paidAt: string | null
  expiresAt: string | null
  rateLimited?: boolean
}

type PaymentSession = {
  invoiceId: string
  qrCodeImageUrl: string | null
  qrCodeCopyPaste: string
  expiresAt: string | null
  amountCents: number
  status: ChargeStatus
  rateLimited: boolean
  paidAt: string | null
  message: string | null
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

function formatCountdown(expiresAt: string | null, nowMs: number) {
  if (!expiresAt) return "Sem Expiração informada"

  const remainingMs = new Date(expiresAt).getTime() - nowMs
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "Expirado"

  const totalSeconds = Math.floor(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function statusBadgeClass(status: InvoiceItem["status"]) {
  if (status === "PAID") return "border-emerald-300/35 bg-emerald-500/12 text-emerald-100"
  if (status === "OVERDUE") return "border-red-300/35 bg-red-500/12 text-red-100"
  if (status === "VOID") return "border-white/20 bg-[#131d45] text-[#ced8fa]"
  return "border-amber-300/35 bg-amber-500/12 text-amber-100"
}

function invoiceStatusLabel(status: InvoiceItem["status"]) {
  if (status === "PAID") return "Pago"
  if (status === "OVERDUE") return "Vencida"
  if (status === "VOID") return "Cancelada"
  return "Em aberto"
}

function chargeBadgeClass(status: ChargeStatus) {
  if (status === "PAID") return "border-emerald-300/35 bg-emerald-500/12 text-emerald-100"
  if (status === "EXPIRED") return "border-red-300/35 bg-red-500/12 text-red-100"
  if (status === "UNKNOWN") return "border-white/20 bg-[#131d45] text-[#ced8fa]"
  return "border-amber-300/35 bg-amber-500/12 text-amber-100"
}

function chargeStatusLabel(status: ChargeStatus) {
  if (status === "PAID") return "Pago"
  if (status === "EXPIRED") return "Expirado"
  if (status === "UNKNOWN") return "Indefinido"
  return "Aguardando"
}

function canClosePaymentModal(session: PaymentSession | null) {
  if (!session) return true
  if (session.status === "PAID" || session.status === "EXPIRED") return true
  if (session.expiresAt) {
    const expiresAt = new Date(session.expiresAt).getTime()
    if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) return true
  }
  return false
}

export default function OwnerFinancePage() {
  const {
    state,
    error: accessError,
    token,
    barbershopStatus,
  } = useOwnerAccess()

  const [month, setMonth] = useState(getBusinessMonth())
  const [summary, setSummary] = useState<FinanceSummaryData | null>(null)
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [completingPast, setCompletingPast] = useState(false)
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null)
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [validatingPayment, setValidatingPayment] = useState(false)
  const [countdownNowMs, setCountdownNowMs] = useState(Date.now())

  const isPaymentExpired = useMemo(() => {
    if (!paymentSession) return false
    if (paymentSession.status === "EXPIRED") return true
    if (!paymentSession.expiresAt) return false
    const expiresAt = new Date(paymentSession.expiresAt).getTime()
    if (Number.isNaN(expiresAt)) return false
    return expiresAt <= countdownNowMs
  }, [paymentSession, countdownNowMs])

  const loadFinanceData = useCallback(async () => {
    if (!token) return

    setLoading(true)
    setError(null)

    try {
      const headers = { Authorization: `Bearer ${token}` }
      await fetch("/api/owner/finance/appointments/complete-past", {
        method: "POST",
        headers,
      })

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
      setError("Falha de conexão ao carregar dados financeiros.")
    } finally {
      setLoading(false)
    }
  }, [month, token])

  const checkPaymentStatus = useCallback(async (invoiceId: string, options?: { manual?: boolean }) => {
    if (!token) return

    try {
      const response = await fetch(`/api/billing/invoices/${invoiceId}/pay/status`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      })

      const result = (await response.json()) as ApiResult<ChargeStatusData>
      if (!result.success) {
        setPaymentSession((current) => {
          if (!current || current.invoiceId !== invoiceId) return current
          return {
            ...current,
            message: resolveErrorMessage(
              result,
              options?.manual
                ? "Pagamento ainda não confirmado."
                : "Falha ao confirmar o pagamento. Tente novamente."
            ),
          }
        })
        return
      }

      const data = result.data
      setPaymentSession((current) => {
        if (!current || current.invoiceId !== invoiceId) return current
        return {
          ...current,
          status: data.status,
          expiresAt: data.expiresAt ?? current.expiresAt,
          rateLimited: Boolean(data.rateLimited),
          paidAt: data.paidAt,
          message:
            data.status === "PAID"
              ? "Pagamento confirmado com sucesso."
              : data.status === "EXPIRED"
                ? "Pagamento não confirmado. Você pode tentar novamente."
                : data.rateLimited
                  ? "Consulta de status em limite temporario. Tente novamente em alguns segundos."
                  : options?.manual
                    ? "Pagamento ainda não confirmado."
                    : null,
        }
      })

      if (data.status === "PAID") {
        await loadFinanceData()
      }
    } catch {
      setPaymentSession((current) => {
        if (!current || current.invoiceId !== invoiceId) return current
        return {
          ...current,
          message: options?.manual
            ? "Falha de conexão ao validar pagamento."
            : "Falha de conexão ao consultar pagamento. Tente novamente.",
        }
      })
    }
  }, [loadFinanceData, token])

  useEffect(() => {
    if (state !== "ready") return
    const timer = window.setTimeout(() => {
      void loadFinanceData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [state, loadFinanceData])

  useEffect(() => {
    if (!paymentSession) return
    const timer = window.setInterval(() => {
      setCountdownNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [paymentSession])

  useEffect(() => {
    if (!paymentSession) return
    if (paymentSession.status === "PAID" || paymentSession.status === "EXPIRED") return
    if (!isPaymentExpired) return

    setPaymentSession((current) => {
      if (!current || current.invoiceId !== paymentSession.invoiceId) return current
      return {
        ...current,
        status: "EXPIRED",
        message: "Pagamento nao confirmado. Gere um novo QR Code para tentar novamente.",
      }
    })
  }, [isPaymentExpired, paymentSession])

  async function completePastAppointments() {
    if (!token) return

    setCompletingPast(true)
    setError(null)
    try {
      const response = await fetch("/api/owner/finance/appointments/complete-past", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const result = (await response.json()) as ApiResult<{ updatedCount: number }>
      if (!result.success) {
        setError(resolveErrorMessage(result, "Falha ao atualizar concluidos."))
        return
      }
      await loadFinanceData()
    } catch {
      setError("Falha de conexão ao atualizar concluidos.")
    } finally {
      setCompletingPast(false)
    }
  }

  async function payInvoice(invoiceId: string) {
    if (!token) return

    setCopyFeedback(null)
    setPayingInvoiceId(invoiceId)
    setError(null)

    try {
      const response = await fetch(`/api/billing/invoices/${invoiceId}/pay`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = (await response.json()) as ApiResult<PayInvoiceData>
      if (!result.success) {
        setError(resolveErrorMessage(result, "Falha ao gerar Cobrança PIX da fatura."))
        return
      }

      const session: PaymentSession = {
        invoiceId: result.data.invoiceId,
        qrCodeImageUrl: result.data.qrCodeImageUrl,
        qrCodeCopyPaste: result.data.qrCodeCopyPaste,
        expiresAt: result.data.expiresAt,
        amountCents: result.data.amountCents,
        status: result.data.status,
        rateLimited: false,
        paidAt: null,
        message: result.data.reused
          ? "Reutilizando Cobrança PIX ativa."
          : "Cobrança PIX criada. Aguarde a confirmação ou valide manualmente.",
      }

      setPaymentSession(session)

      if (session.status === "PAID") {
        await loadFinanceData()
        return
      }
    } catch {
      setError("Falha de conexão ao gerar Cobrança PIX.")
    } finally {
      setPayingInvoiceId(null)
    }
  }

  async function retryPayment() {
    if (!paymentSession) return
    await payInvoice(paymentSession.invoiceId)
  }

  async function validatePaymentNow() {
    if (!paymentSession) return

    setValidatingPayment(true)
    try {
      await checkPaymentStatus(paymentSession.invoiceId, { manual: true })
    } finally {
      setValidatingPayment(false)
    }
  }

  async function copyPixCode() {
    if (!paymentSession?.qrCodeCopyPaste) return

    try {
      await navigator.clipboard.writeText(paymentSession.qrCodeCopyPaste)
      setCopyFeedback("Código PIX copiado.")
    } catch {
      setCopyFeedback("Não foi possível copiar o Código PIX.")
    }
  }

  function closePaymentModal() {
    if (!canClosePaymentModal(paymentSession)) return
    setPaymentSession(null)
    setCopyFeedback(null)
  }

  function deferPaymentModal() {
    setPaymentSession(null)
    setCopyFeedback(null)
  }

  const cards = useMemo(() => [
    {
      label: "Agendamentos no Mês",
      value: summary ? String(summary.monthlyAppointmentsCount) : "--",
    },
    {
      label: "Valor do Mês (Serviços)",
      value: summary ? formatCurrency(summary.monthlyServiceAmountCents) : "--",
    },
    {
      label: "Valor total do Mês (cliente)",
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
      subtitle="Acompanhe valores do Mês, faturas semanais e status financeiro da barbearia."
      activePath="/owner/finance"
      statusLabel={barbershopStatus}
    >
      {summary?.financialStatus === "BLOCKED" ? (
        <p className="rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
          Sua barbearia esta bloqueada por Pendência financeira. Regularize para voltar a receber agendamentos.
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
            <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Mês</span>
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
          <button
            type="button"
            onClick={() => void completePastAppointments()}
            disabled={completingPast}
            className="inline-flex rounded-lg border border-white/15 bg-[#0f1b49]/70 px-3 py-2 text-sm font-semibold text-[#d8e3ff] transition hover:bg-[#14245f] disabled:opacity-70"
          >
            {completingPast ? "Processando..." : "Atualizar concluidos"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <article key={card.label} className="rounded-2xl border border-white/12 bg-[#091029]/90 p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">{card.label}</p>
              <p className="mt-1 text-2xl font-bold">{card.value}</p>
            </article>
          ))}
        </div>

        {summary ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-2xl border border-white/12 bg-[#091029]/90 p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Ganhos da semana</p>
              <p className="mt-1 text-2xl font-bold">{formatCurrency(summary.weeklyServiceAmountCents)}</p>
            </article>
            <article className="rounded-2xl border border-white/12 bg-[#091029]/90 p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Total da semana (cliente)</p>
              <p className="mt-1 text-2xl font-bold">{formatCurrency(summary.weeklyTotalAmountCents)}</p>
            </article>
            <article className="rounded-2xl border border-white/12 bg-[#091029]/90 p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Agendamentos na semana</p>
              <p className="mt-1 text-2xl font-bold">{summary.weeklyAppointmentsCount}</p>
            </article>
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-2xl border border-white/12 bg-[#0b1330]/82 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Faturas semanais</h2>
            <p className="mt-1 text-sm text-[#aeb8db]">
              Fechamento automatico semanal do total de taxas cobradas.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {invoices.length > 0 ? (
            invoices.map((invoice) => {
              const isExpanded = expandedInvoiceId === invoice.id
              const isPaying = payingInvoiceId === invoice.id
              const isAwaitingPayment =
                paymentSession?.invoiceId === invoice.id &&
                (paymentSession.status === "PENDING" || paymentSession.status === "UNKNOWN")

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
                        {invoiceStatusLabel(invoice.status)}
                      </span>
                      {(invoice.status === "OPEN" || invoice.status === "OVERDUE") ? (
                        <button
                          type="button"
                          onClick={() => void payInvoice(invoice.id)}
                          disabled={isPaying || isAwaitingPayment}
                          className="rounded-lg border border-[#f36c20]/45 bg-[#f36c20]/16 px-3 py-1.5 text-xs font-semibold text-[#ffd8c2] transition hover:bg-[#f36c20]/25 disabled:opacity-70"
                        >
                          {isPaying ? "Gerando PIX..." : isAwaitingPayment ? "Aguardando pagamento..." : "Pagar fatura"}
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
                              Taxa: {formatCurrency(item.appointment.serviceFeeCents)} | Serviço: {formatCurrency(item.appointment.servicePriceCents)}
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
              Nenhuma fatura semanal gerada até o momento.
            </p>
          )}
        </div>
      </section>

      {paymentSession ? (
        <div className="fixed inset-0 z-[1200]">
          <div
            className={`absolute inset-0 bg-[#01020a]/75 transition-opacity ${canClosePaymentModal(paymentSession) ? "cursor-pointer" : "cursor-not-allowed"}`}
            onClick={closePaymentModal}
          />

          <div className="absolute left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/15 bg-[linear-gradient(180deg,rgba(14,20,49,0.98)_0%,rgba(8,13,33,0.98)_100%)] p-5 text-[#f4f6ff] shadow-[0_28px_75px_rgba(0,0,0,0.55)]">
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.1em] text-[#aeb8db]">Pagamento PIX</p>
                <h3 className="text-xl font-semibold">Fatura semanal</h3>
                <p className="mt-1 text-xs text-[#b7c2e8]">Escaneie o QR Code ou copie o Código para pagar.</p>
              </div>
              {canClosePaymentModal(paymentSession) ? (
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[#dbe4ff] transition hover:bg-white/10"
                  aria-label="Fechar pagamento"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <path d="M6 6 18 18M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              ) : null}
            </header>
            {paymentSession.status === "PAID" ? (
              <div className="mt-4 rounded-2xl border border-emerald-300/35 bg-[linear-gradient(145deg,rgba(16,185,129,0.2)_0%,rgba(16,185,129,0.08)_55%,rgba(8,13,33,0.95)_100%)] p-4">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200/35 bg-emerald-400/20 text-emerald-100">
                    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                      <path d="m5 12 4.2 4.2L19 6.8" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.1em] text-emerald-100/90">Tudo certo!</p>
                    <h4 className="text-lg font-semibold text-emerald-50">Pagamento confirmado</h4>
                    <p className="mt-1 text-sm text-emerald-100/90">
                      Recebemos o pagamento da fatura e liberamos o financeiro automaticamente.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 rounded-xl border border-emerald-200/25 bg-[#07142c]/70 p-3 text-sm text-emerald-50 sm:grid-cols-2">
                  <p>
                    <span className="text-emerald-100/75">Valor:</span> {formatCurrency(paymentSession.amountCents)}
                  </p>
                  <p>
                    <span className="text-emerald-100/75">Pago em:</span> {paymentSession.paidAt ? formatDateTime(paymentSession.paidAt) : "agora"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/12 bg-[#0a1331]/85 p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Valor</p>
                    <p className="mt-1 text-xl font-bold">{formatCurrency(paymentSession.amountCents)}</p>
                    <p className="mt-2 text-xs text-[#c6d1ef]">
                      Expira em: {paymentSession.expiresAt ? formatDateTime(paymentSession.expiresAt) : "Não informado"}
                    </p>
                    <p className="mt-1 text-xs text-[#c6d1ef]">
                      Tempo restante: {formatCountdown(paymentSession.expiresAt, countdownNowMs)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/12 bg-[#0a1331]/85 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${chargeBadgeClass(paymentSession.status)}`}>
                        {chargeStatusLabel(paymentSession.status)}
                      </span>
                      {!paymentSession.message &&
                      (paymentSession.status === "PENDING" || paymentSession.status === "UNKNOWN") ? (
                        <span className="text-xs text-[#b7c2e8]">Aguardando pagamento...</span>
                      ) : null}
                    </div>

                    {paymentSession.message ? (
                      <p className="mt-2 text-xs text-[#c6d1ef]">{paymentSession.message}</p>
                    ) : null}

                    {paymentSession.rateLimited ? (
                      <p className="mt-2 text-xs text-amber-100">
                        Limite temporario ao consultar status. Tente novamente em alguns segundos.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/12 bg-[#0a1331]/85 p-4">
                  <div className="flex flex-col items-center justify-center gap-3">
                    {paymentSession.qrCodeImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={paymentSession.qrCodeImageUrl}
                        alt="QR Code PIX"
                        className="h-56 w-56 rounded-xl border border-white/15 bg-white object-contain"
                      />
                    ) : (
                      <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-dashed border-white/20 bg-[#091029]/80 text-xs text-[#b7c2e8]">
                        QR Code indisponivel no momento.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => void copyPixCode()}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-[#d8e3ff] transition hover:bg-white/10"
                    >
                      Copiar Código PIX
                    </button>
                    {copyFeedback ? <span className="text-xs text-[#b7c2e8]">{copyFeedback}</span> : null}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {paymentSession.status !== "PAID" ? (
                <button
                  type="button"
                  onClick={deferPaymentModal}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-[#d8e3ff] transition hover:bg-white/10"
                >
                  Voltar e pagar depois
                </button>
              ) : null}

              {(paymentSession.status === "PENDING" || paymentSession.status === "UNKNOWN") ? (
                <button
                  type="button"
                  onClick={() => void validatePaymentNow()}
                  disabled={validatingPayment}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-[#d8e3ff] transition hover:bg-white/10 disabled:opacity-70"
                >
                  {validatingPayment ? "Validando..." : "Já efetuei o pagamento"}
                </button>
              ) : null}

              {isPaymentExpired ? (
                <button
                  type="button"
                  onClick={() => void retryPayment()}
                  className="rounded-lg border border-[#f36c20]/45 bg-[#f36c20]/16 px-3 py-1.5 text-xs font-semibold text-[#ffd8c2] transition hover:bg-[#f36c20]/25"
                >
                  Gerar novo QR Code
                </button>
              ) : null}

              {paymentSession.status === "PAID" ? (
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="rounded-lg border border-emerald-300/35 bg-emerald-500/12 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                >
                  Fechar
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </OwnerShell>
  )
}
