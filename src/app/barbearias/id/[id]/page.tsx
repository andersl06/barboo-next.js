import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { PremiumBackground } from "@/components/background"
import { prisma } from "@/lib/db/prisma"

type ByIdPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function BarbershopByIdPage({ params }: ByIdPageProps) {
  const { id } = await params

  const barbershop = await prisma.barbershop.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  })

  if (!barbershop) {
    notFound()
  }

  if (barbershop.slug) {
    redirect(`/barbearias/${barbershop.slug}`)
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
      <PremiumBackground />
      <section className="relative z-10 mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,54,0.9)_0%,rgba(13,17,41,0.94)_100%)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <h1 className="text-3xl font-bold">{barbershop.name}</h1>
        <p className="mt-2 text-sm text-[#a7b1d0] md:text-base">
          A página pública da barbearia ainda não tem slug configurada.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/owner/barbershop/edit"
            className="inline-flex rounded-xl border border-white/15 bg-[#0b1330]/70 px-4 py-2 text-sm font-semibold text-[#dbe4ff] transition hover:bg-[#111b45]"
          >
            Editar barbearia
          </Link>
          <Link
            href="/owner/dashboard"
            className="inline-flex rounded-xl border border-white/15 bg-transparent px-4 py-2 text-sm font-semibold text-[#dbe4ff] transition hover:bg-[#111b45]"
          >
            Voltar ao dashboard
          </Link>
        </div>
      </section>
    </main>
  )
}
