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

type CategoryData = {
  id: string
  isActive: boolean
}

type ServiceData = {
  id: string
  isActive: boolean
}

type TeamData = {
  userId: string
  role: "OWNER" | "BARBER"
  isActive: boolean
}

type DashboardData = {
  barbershop: BarbershopData
  categories: CategoryData[]
  services: ServiceData[]
  team: TeamData[]
}

const CARD_LINKS = [
  {
    href: "/owner/barbershop/edit",
    title: "Editar barbearia",
    description: "Dados principais, endereco, slug e perfil da barbearia.",
  },
  {
    href: "/owner/categories",
    title: "Categorias",
    description: "Criar, editar e inativar categorias do catalogo.",
  },
  {
    href: "/owner/services",
    title: "Servicos",
    description: "Criar, atualizar valores e organizar os servicos.",
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

      const [shopResponse, categoryResponse, serviceResponse, teamResponse] =
        await Promise.all([
          fetch(`/api/barbershops/${ownerBarbershopId}`, { headers, cache: "no-store" }),
          fetch(`/api/barbershops/${ownerBarbershopId}/categories?includeInactive=true`, {
            headers,
            cache: "no-store",
          }),
          fetch(`/api/barbershops/${ownerBarbershopId}/services?includeInactive=true`, {
            headers,
            cache: "no-store",
          }),
          fetch(`/api/barbershops/${ownerBarbershopId}/barbers`, {
            headers,
            cache: "no-store",
          }),
        ])

      const [shopResult, categoryResult, serviceResult, teamResult] = (await Promise.all([
        shopResponse.json() as Promise<ApiResult<BarbershopData>>,
        categoryResponse.json() as Promise<ApiResult<CategoryData[]>>,
        serviceResponse.json() as Promise<ApiResult<ServiceData[]>>,
        teamResponse.json() as Promise<ApiResult<TeamData[]>>,
      ]))

      if (!shopResult.success) {
        setError(resolveErrorMessage(shopResult, "Falha ao carregar barbearia."))
        return
      }

      if (!categoryResult.success) {
        setError(resolveErrorMessage(categoryResult, "Falha ao carregar categorias."))
        return
      }

      if (!serviceResult.success) {
        setError(resolveErrorMessage(serviceResult, "Falha ao carregar servicos."))
        return
      }

      if (!teamResult.success) {
        setError(resolveErrorMessage(teamResult, "Falha ao carregar equipe."))
        return
      }

      setData({
        barbershop: shopResult.data,
        categories: categoryResult.data,
        services: serviceResult.data,
        team: teamResult.data,
      })
    } catch {
      setError("Falha de conexao ao carregar o dashboard.")
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
        title="Dashboard do proprietario"
        subtitle="Centralize toda a operacao da sua barbearia."
        activePath="/owner/dashboard"
        statusLabel={barbershopStatus}
      >
        <OwnerGate state={state} error={accessError} />
      </OwnerShell>
    )
  }

  return (
    <OwnerShell
      title={`Dashboard ${data?.barbershop.name ? `- ${data.barbershop.name}` : "do proprietario"}`}
      subtitle="Resumo rapido da operacao e atalhos para cada configuracao."
      activePath="/owner/dashboard"
      statusLabel={data?.barbershop.status ?? barbershopStatus}
      hideNavigation
    >
      {error ? (
        <p className="rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Categorias ativas</p>
          <p className="mt-1 text-2xl font-bold">
            {data ? data.categories.filter((item) => item.isActive).length : "-"}
          </p>
        </article>
        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Servicos ativos</p>
          <p className="mt-1 text-2xl font-bold">
            {data ? data.services.filter((item) => item.isActive).length : "-"}
          </p>
        </article>
        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Equipe ativa</p>
          <p className="mt-1 text-2xl font-bold">
            {data ? data.team.filter((item) => item.isActive).length : "-"}
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
