import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { PremiumBackground } from "@/components/background"

type AuthContainerProps = {
  title: string
  subtitle?: string
  children: ReactNode
}

export function AuthContainer({ title, subtitle, children }: AuthContainerProps) {
  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 md:px-8 md:py-12">
      <PremiumBackground />

      <section className="relative z-10 mx-auto flex min-h-[85svh] w-full max-w-6xl items-center justify-center">
        <div className="relative w-full max-w-[760px] overflow-hidden rounded-[26px] border border-white/12 bg-[linear-gradient(180deg,rgba(17,24,66,0.9)_0%,rgba(11,16,43,0.95)_100%)] p-6 shadow-[0_35px_90px_rgba(0,0,0,0.65)] md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(95%_65%_at_30%_30%,rgba(73,105,219,0.24),transparent_65%)]" />
          <div className="pointer-events-none absolute -right-8 top-0 h-24 w-56 rotate-[-18deg] bg-[linear-gradient(90deg,rgba(255,120,39,0)_0%,rgba(255,120,39,0.85)_60%,rgba(255,120,39,0)_100%)] blur-[1px]" />
          <div className="pointer-events-none absolute -bottom-10 -left-20 h-40 w-[140%] rotate-[-26deg] bg-[linear-gradient(90deg,rgba(37,95,224,0)_0%,rgba(62,119,245,0.4)_50%,rgba(37,95,224,0)_100%)]" />

          <div className="relative z-10">
            <div className="flex items-start justify-between gap-3">
              <Link href="/" className="inline-flex">
                <Image
                  src="/assets/brand/barboo_logo.png"
                  alt="Barboo"
                  width={280}
                  height={82}
                  priority
                  className="h-auto w-[190px] md:w-[230px]"
                />
              </Link>

              <Link
                href="/"
                className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-[#a7b2d7] transition hover:text-white"
              >
                Voltar
              </Link>
            </div>

            <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-[-0.02em] text-[#f4f6ff] md:text-4xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-sm leading-relaxed text-[#aeb8db] md:text-base">
                {subtitle}
              </p>
            ) : null}

            <div className="mt-6">{children}</div>
          </div>
        </div>
      </section>
    </main>
  )
}
