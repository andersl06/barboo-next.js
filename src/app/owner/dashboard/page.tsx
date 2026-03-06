"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { OwnerGate } from "@/components/owner/OwnerGate"
import { OwnerShell } from "@/components/owner/OwnerShell"
import { useOwnerAccess } from "@/lib/client/use-owner-access"

type ApiFailure = {
  success: false
  code: string
  message: string
  errors?: Array<{
    field?: string | number
    message: string
  }>
}

type ApiResult<T> = { success: true; data: T } | ApiFailure

type BarbershopData = {
  id: string
  name: string
  status: string
  city: string | null
  neighborhood: string | null
  slug: string | null
}

type DashboardData = {
  barbershop: BarbershopData
  finance: {
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
}

const CARD_LINKS = [
  {
    href: "/owner/barbershop/edit",
    title: "Editar barbearia",
    description: "Dados principais, Endereço, slug e perfil da barbearia.",
  },
  {
    href: "/owner/categories",
    title: "Categorias",
    description: "Criar, editar e inativar categorias do catalogo.",
  },
  {
    href: "/owner/services",
    title: "Serviços",
    description: "Criar, atualizar valores e organizar os Serviços.",
  },
  {
    href: "/owner/team",
    title: "Equipe",
    description: "Adicionar barbeiros, editar perfil e remover da barbearia.",
  },
  {
    href: "/owner/availability",
    title: "Disponibilidade",
    description: "Definir agenda semanal de cada barbeiro.",
  },
  {
    href: "/owner/finance",
    title: "Financeiro",
    description: "Area reservada para indicadores financeiros.",
  },
] as const

function resolveErrorMessage(result: ApiFailure, fallback: string) {
  if (result.errors?.[0]?.message) {
    return result.errors[0].message
  }
  return result.message || fallback
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function getBusinessMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date()).slice(0, 7)
}

export default function OwnerDashboardPage() {
  const {
    state,
    error: accessError,
    token,
    ownerBarbershopId,
    barbershopStatus,
  } = useOwnerAccess()

  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)

  const loadDashboard = useCallback(async () => {
    if (!token || !ownerBarbershopId) return

    setError(null)
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      }

      const [shopResponse, financeResponse] =
        await Promise.all([
          fetch(`/api/barbershops/${ownerBarbershopId}`, { headers, cache: "no-store" }),
          fetch(`/api/owner/finance/summary?month=${encodeURIComponent(getBusinessMonth())}`, {
            headers,
            cache: "no-store",
          }),
        ])

      const [shopResult, financeResult] = (await Promise.all([
        shopResponse.json() as Promise<ApiResult<BarbershopData>>,
        financeResponse.json() as Promise<ApiResult<DashboardData["finance"]>>,
      ]))

      if (!shopResult.success) {
        setError(resolveErrorMessage(shopResult, "Falha ao carregar barbearia."))
        return
      }

      if (!financeResult.success) {
        setError(resolveErrorMessage(financeResult, "Falha ao carregar resumo financeiro."))
        return
      }

      setData({
        barbershop: shopResult.data,
        finance: financeResult.data,
      })
    } catch {
      setError("Falha de conexão ao carregar o dashboard.")
    }
  }, [ownerBarbershopId, token])

  useEffect(() => {
    if (state !== "ready") return

    const timer = window.setTimeout(() => {
      void loadDashboard()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [state, loadDashboard])

  if (state !== "ready") {
    return (
      <OwnerShell
        title="Dashboard do proprietário"
        subtitle="Centralize toda a operação da sua barbearia."
        activePath="/owner/dashboard"
        statusLabel={barbershopStatus}
      >
        <OwnerGate state={state} error={accessError} />
      </OwnerShell>
    )
  }

  return (
    <OwnerShell
      title={`Dashboard ${data?.barbershop.name ? `- ${data.barbershop.name}` : "do proprietário"}`}
      subtitle="Resumo rápido da operação e atalhos para cada configuração."
      activePath="/owner/dashboard"
      statusLabel={data?.barbershop.status ?? barbershopStatus}
      hideNavigation
    >
      {error ? (
        <p className="rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      {data?.finance.financialStatus === "BLOCKED" ? (
        <p className="mt-3 rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
          Sua barbearia esta bloqueada por Pendência financeira. Regularize para voltar a receber agendamentos.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Ganhos da semana</p>
          <p className="mt-1 text-2xl font-bold">
            {data ? formatCurrency(data.finance.weeklyServiceAmountCents) : "--"}
          </p>
        </article>
        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Total semana (cliente)</p>
          <p className="mt-1 text-2xl font-bold">
            {data ? formatCurrency(data.finance.weeklyTotalAmountCents) : "--"}
          </p>
        </article>
        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Agendamentos na semana</p>
          <p className="mt-1 text-2xl font-bold">
            {data ? data.finance.weeklyAppointmentsCount : "--"}
          </p>
        </article>
        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Faturas abertas</p>
          <p className="mt-1 text-2xl font-bold">
            {data ? data.finance.invoiceStatusTotals.OPEN : "--"}
          </p>
        </article>
        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Faturas vencidas</p>
          <p className="mt-1 text-2xl font-bold">
            {data ? data.finance.invoiceStatusTotals.OVERDUE : "--"}
          </p>
        </article>
        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Valor do Mês (Serviços)</p>
          <p className="mt-1 text-2xl font-bold">
            {data ? formatCurrency(data.finance.monthlyServiceAmountCents) : "--"}
          </p>
          <p className="mt-1 text-xs text-[#9eabd4]">
            {data ? `${data.finance.monthlyAppointmentsCount} agendamentos no Mês` : ""}
          </p>
        </article>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CARD_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(11,19,48,0.92)_0%,rgba(9,15,38,0.92)_100%)] p-4 transition hover:-translate-y-[1px] hover:border-[#f36c20]/40"
          >
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="mt-1 text-sm text-[#aeb8db]">{item.description}</p>
          </Link>
        ))}
      </div>
    </OwnerShell>
  )
}
