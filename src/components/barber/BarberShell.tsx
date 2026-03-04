"use client"

import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { PremiumBackground } from "@/components/background"

type BarberShellProps = {
  title: string
  subtitle?: string
  activePath: string
  statusLabel?: string | null
  hideNavigation?: boolean
  children: ReactNode
}

export function BarberShell({
  title,
  subtitle,
  activePath,
  statusLabel,
  hideNavigation = false,
  children,
}: BarberShellProps) {
  void activePath
  void statusLabel
  void hideNavigation

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
      <PremiumBackground />
      <section className="relative z-10 mx-auto w-full max-w-6xl rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,54,0.9)_0%,rgba(13,17,41,0.94)_100%)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.6)] md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/assets/brand/barboo_logo.png"
                alt="Barboo"
                width={250}
                height={70}
                className="h-auto w-[165px]"
              />
              <Link
                href="/"
                aria-label="Voltar para pagina inicial"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#0b1330]/70 text-lg text-[#d8e3ff] transition hover:bg-white/10"
              >
                {"<"}
              </Link>
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-[#a7b1d0] md:text-base">{subtitle}</p> : null}
          </div>
          <div />
        </div>

        <div className="mt-5">{children}</div>
      </section>
    </main>
  )
}
