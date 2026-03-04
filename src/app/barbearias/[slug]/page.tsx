"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { PremiumBackground } from "@/components/background"

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

type BarbershopDetail = {
  id: string
  slug: string
  name: string
  description: string | null
  phone: string | null
  city: string | null
  neighborhood: string | null
  categories: Array<{
    id: string
    name: string
  }>
  services: Array<{
    id: string
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

export default function BarbeariaDetalhePage() {
  const params = useParams<{ slug: string }>()
  const slug = typeof params?.slug === "string" ? params.slug : ""
  const [state, setState] = useState<ScreenState>("loading")
  const [error, setError] = useState<string | null>(null)
  const [barbershop, setBarbershop] = useState<BarbershopDetail | null>(null)

  useEffect(() => {
    if (!slug) {
      return
    }

    async function load() {
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
        setError("Falha de conexao ao carregar a barbearia.")
        setState("error")
      }
    }

    void load()
  }, [slug])

  if (state === "loading") {
    if (!slug) {
      return (
        <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
          <PremiumBackground />
          <section className="relative z-10 mx-auto max-w-4xl rounded-3xl border border-white/10 bg-[#0d1434]/80 p-6">
            <h1 className="text-2xl font-bold">Slug invalido</h1>
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
          <h1 className="text-2xl font-bold">Nao foi possivel abrir a barbearia</h1>
          <p className="mt-2 text-sm text-[#c5cee9]">{error ?? "Erro inesperado."}</p>
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
      <section className="relative z-10 mx-auto w-full max-w-6xl rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,54,0.9)_0%,rgba(13,17,41,0.94)_100%)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <h1 className="text-3xl font-bold">{barbershop.name}</h1>
        <p className="mt-2 text-sm text-[#a7b1d0]">
          {[barbershop.neighborhood, barbershop.city].filter(Boolean).join(" - ")}
        </p>
        {barbershop.description ? (
          <p className="mt-4 text-sm text-[#d3daf3] md:text-base">{barbershop.description}</p>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/12 bg-[#0b1330]/80 p-4">
            <h2 className="text-lg font-semibold">Servicos</h2>
            <div className="mt-3 space-y-2 text-sm">
              {barbershop.services.length > 0 ? (
                barbershop.services.map((service) => (
                  <p key={service.id}>
                    {service.name} - R$ {(service.priceCents / 100).toFixed(2)} ({service.durationMinutes} min)
                  </p>
                ))
              ) : (
                <p className="text-[#9ca7cb]">Nenhum servico publicado.</p>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-white/12 bg-[#0b1330]/80 p-4">
            <h2 className="text-lg font-semibold">Categorias</h2>
            <div className="mt-3 space-y-2 text-sm">
              {barbershop.categories.length > 0 ? (
                barbershop.categories.map((category) => <p key={category.id}>{category.name}</p>)
              ) : (
                <p className="text-[#9ca7cb]">Sem categorias ativas.</p>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-white/12 bg-[#0b1330]/80 p-4">
            <h2 className="text-lg font-semibold">Barbeiros</h2>
            <div className="mt-3 space-y-3 text-sm">
              {barbershop.barbers.length > 0 ? (
                barbershop.barbers.map((barber) => (
                  <div key={barber.userId}>
                    <p className="font-semibold">{barber.name}</p>
                    <p className="text-[#a7b1d0]">{barber.bio ?? "Sem bio cadastrada."}</p>
                  </div>
                ))
              ) : (
                <p className="text-[#9ca7cb]">Nenhum barbeiro listado.</p>
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}
