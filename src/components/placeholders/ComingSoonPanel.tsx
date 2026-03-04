import Link from "next/link"
import { PremiumBackground } from "@/components/background"

type ComingSoonPanelProps = {
  title: string
  description: string
  backHref?: string
}

export function ComingSoonPanel({
  title,
  description,
  backHref = "/cliente/barbearias-proximas",
}: ComingSoonPanelProps) {
  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
      <PremiumBackground />
      <section className="relative z-10 mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,54,0.9)_0%,rgba(13,17,41,0.94)_100%)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <p className="inline-flex rounded-full border border-[#f36c20]/35 bg-[#f36c20]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#ffd8c2]">
          Em breve
        </p>
        <h1 className="mt-4 text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-[#a7b1d0] md:text-base">{description}</p>
        <Link
          href={backHref}
          className="mt-5 inline-flex rounded-xl border border-white/15 bg-[#0b1330]/70 px-4 py-2 text-sm font-semibold text-[#dbe4ff] transition hover:bg-[#111b45]"
        >
          Voltar
        </Link>
      </section>
    </main>
  )
}
