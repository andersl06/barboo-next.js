import Image from "next/image"
import { PremiumBackground } from "@/components/background"
import { LoginForm } from "@/components/auth/LoginForm"

type LoginPageProps = {
  searchParams: Promise<{
    registered?: string
    reset?: string
    next?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams
  const registered = query.registered === "1"
  const reset = query.reset === "1"
  const nextPath = typeof query.next === "string" ? query.next : null

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 md:px-8 md:py-12">
      <PremiumBackground />

      <section className="relative z-10 mx-auto flex min-h-[85svh] w-full max-w-6xl items-center justify-center">
        <div className="relative w-full max-w-[640px] overflow-hidden rounded-[26px] border border-white/12 bg-[linear-gradient(180deg,rgba(17,24,66,0.9)_0%,rgba(11,16,43,0.95)_100%)] p-6 shadow-[0_35px_90px_rgba(0,0,0,0.65)] md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(95%_65%_at_30%_30%,rgba(73,105,219,0.24),transparent_65%)]" />
          <div className="pointer-events-none absolute -right-8 top-0 h-24 w-56 rotate-[-18deg] bg-[linear-gradient(90deg,rgba(255,120,39,0)_0%,rgba(255,120,39,0.95)_60%,rgba(255,120,39,0)_100%)] blur-[1px]" />
          <div className="pointer-events-none absolute -bottom-10 -left-20 h-40 w-[140%] rotate-[-26deg] bg-[linear-gradient(90deg,rgba(37,95,224,0)_0%,rgba(62,119,245,0.45)_50%,rgba(37,95,224,0)_100%)]" />

          <div className="relative z-10">
            <div className="mb-8 flex justify-center">
              <Image
                src="/assets/brand/barboo_logo.png"
                alt="Barboo"
                width={360}
                height={100}
                priority
                className="h-auto w-[240px] md:w-[300px]"
              />
            </div>

            <LoginForm registered={registered} reset={reset} nextPath={nextPath} />
          </div>
        </div>
      </section>
    </main>
  )
}
