import Image from "next/image"
import Link from "next/link"
import { AuthContainer } from "@/components/auth/AuthContainer"

export default function CadastroPage() {
  return (
    <AuthContainer title="Escolha seu tipo de cadastro">
      <div className="space-y-4">
        <Link
          href="/cadastro/proprietario"
          className="group block rounded-2xl border border-[#f36c20]/45 bg-[linear-gradient(180deg,rgba(243,108,32,0.18)_0%,rgba(243,108,32,0.08)_100%)] p-4 transition hover:-translate-y-[1px] hover:border-[#f36c20]/70"
        >
          <div className="flex items-start gap-3">
            <Image src="/assets/icons/file.png" alt="" width={34} height={34} className="mt-0.5 h-[34px] w-[34px]" />
            <div>
              <h3 className="text-base font-semibold text-[#ffe0cf]">
                Quero cadastrar minha barbearia
              </h3>
            </div>
          </div>
        </Link>

        <Link
          href="/cadastro/cliente"
          className="group block rounded-2xl border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] p-4 transition hover:-translate-y-[1px] hover:border-white/30"
        >
          <div className="flex items-start gap-3">
            <Image src="/assets/icons/user.png" alt="" width={34} height={34} className="mt-0.5 h-[34px] w-[34px]" />
            <div>
              <h3 className="text-base font-semibold text-[#e7ebff]">
                Quero agendar servicos
              </h3>
            </div>
          </div>
        </Link>
      </div>
    </AuthContainer>
  )
}
