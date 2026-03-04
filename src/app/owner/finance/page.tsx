"use client"

import Link from "next/link"
import { OwnerGate } from "@/components/owner/OwnerGate"
import { OwnerShell } from "@/components/owner/OwnerShell"
import { useOwnerAccess } from "@/lib/client/use-owner-access"

export default function OwnerFinancePage() {
  const { state, error: accessError, barbershopStatus } = useOwnerAccess()

  if (state !== "ready") {
    return (
      <OwnerShell
        title="Financeiro"
        subtitle="Area reservada para indicadores financeiros."
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
      subtitle="URL preparada para o modulo financeiro."
      activePath="/owner/finance"
      statusLabel={barbershopStatus}
    >
      <section className="rounded-2xl border border-white/12 bg-[#0b1330]/82 p-5">
        <h2 className="text-xl font-semibold">Modulo em planejamento</h2>
        <p className="mt-2 text-sm text-[#b9c6eb]">
          Essa area ja esta pronta na navegacao do owner e pode receber os cards de faturamento,
          comissoes, repasses e extratos quando voce decidir iniciar o backend financeiro.
        </p>
        <div className="mt-4">
          <Link
            href="/owner/dashboard"
            className="inline-flex rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[#d8e3ff] hover:bg-white/10"
          >
            Voltar ao dashboard
          </Link>
        </div>
      </section>
    </OwnerShell>
  )
}

