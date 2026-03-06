"use client"

import Link from "next/link"
import { UIButton } from "@/components/ui/UIButton"

type OwnerGateState = "loading" | "unauthenticated" | "no_barbershop"

type OwnerGateProps = {
  state: OwnerGateState
  error?: string | null
}

export function OwnerGate({ state, error }: OwnerGateProps) {
  if (state === "loading") {
    return (
      <section className="rounded-2xl border border-white/12 bg-[#0b1330]/80 p-5 text-center">
        <p className="text-[#d0d7ef]">Carregando ambiente do proprietário...</p>
      </section>
    )
  }

  if (state === "unauthenticated") {
    return (
      <section className="rounded-2xl border border-white/12 bg-[#0b1330]/80 p-5 text-center">
        <p className="text-[#d0d7ef]">Você precisa fazer login para acessar essa area.</p>
        {error ? <p className="mt-2 text-sm text-red-200">{error}</p> : null}
        <div className="mt-4">
          <UIButton href="/login?next=%2Fowner%2Fdashboard">Ir para login</UIButton>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-white/12 bg-[#0b1330]/80 p-5 text-center">
      <p className="text-[#d0d7ef]">Nenhuma barbearia encontrada para este proprietário.</p>
      {error ? <p className="mt-2 text-sm text-red-200">{error}</p> : null}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <UIButton href="/onboarding/proprietario">Iniciar onboarding</UIButton>
        <Link
          href="/cadastro/proprietario"
          className="inline-flex rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[#d8e3ff] hover:bg-white/10"
        >
          Criar conta owner
        </Link>
      </div>
    </section>
  )
}

