"use client"

import Link from "next/link"
import { UIButton } from "@/components/ui/UIButton"
import type { BarberAccessState } from "@/lib/client/use-barber-access"

type BarberGateProps = {
  state: Exclude<BarberAccessState, "ready">
  error?: string | null
}

export function BarberGate({ state, error }: BarberGateProps) {
  if (state === "loading") {
    return (
      <section className="rounded-2xl border border-white/12 bg-[#0b1330]/80 p-5 text-center">
        <p className="text-[#d0d7ef]">Carregando ambiente do barbeiro...</p>
      </section>
    )
  }

  if (state === "must_change_password") {
    return (
      <section className="rounded-2xl border border-white/12 bg-[#0b1330]/80 p-5 text-center">
        <p className="text-[#d0d7ef]">Você precisa trocar sua senha para continuar.</p>
        <div className="mt-4">
          <UIButton href="/barber/change-password">Ir para troca de senha</UIButton>
        </div>
      </section>
    )
  }

  if (state === "unauthenticated") {
    return (
      <section className="rounded-2xl border border-white/12 bg-[#0b1330]/80 p-5 text-center">
        <p className="text-[#d0d7ef]">Você precisa fazer login para acessar essa area.</p>
        {error ? <p className="mt-2 text-sm text-red-200">{error}</p> : null}
        <div className="mt-4">
          <UIButton href="/login?next=%2Fbarber%2Fdashboard">Ir para login</UIButton>
        </div>
      </section>
    )
  }

  if (state === "forbidden") {
    return (
      <section className="rounded-2xl border border-white/12 bg-[#0b1330]/80 p-5 text-center">
        <p className="text-[#d0d7ef]">Esse modulo e exclusivo para barbeiros.</p>
        {error ? <p className="mt-2 text-sm text-red-200">{error}</p> : null}
        <div className="mt-4">
          <Link
            href="/"
            className="inline-flex rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[#d8e3ff] hover:bg-white/10"
          >
            Voltar para home
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-white/12 bg-[#0b1330]/80 p-5 text-center">
      <p className="text-[#d0d7ef]">Nenhuma barbearia vinculada para este barbeiro.</p>
      {error ? <p className="mt-2 text-sm text-red-200">{error}</p> : null}
    </section>
  )
}

