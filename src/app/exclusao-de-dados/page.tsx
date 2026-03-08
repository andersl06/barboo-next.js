import { PremiumBackground } from "@/components/background"
import { UIButton } from "@/components/ui/UIButton"

const LAST_UPDATED = "Março de 2026"

export default function DataDeletionPage() {
  return (
    <main className="relative min-h-[100svh] overflow-x-hidden bg-[#070B16] px-4 py-10 md:px-8 md:py-14">
      <PremiumBackground />

      <section className="relative z-10 mx-auto w-full max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[#8fa2d6]">
              Barboo
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#f4f6ff] md:text-4xl">
              Solicitação de Exclusão de Dados
            </h1>
            <p className="mt-2 text-sm text-[#b8c3e6]">
              Última atualização: {LAST_UPDATED}
            </p>
          </div>

          <UIButton variant="secondary" href="/">
            Voltar ao início
          </UIButton>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0b1330]/80 p-6 text-[#d6def8] shadow-[0_28px_70px_rgba(5,8,20,0.55)] md:p-10">
          <section className="space-y-4 text-sm leading-relaxed text-[#c7d2f2]">
            <p>
              Esta página explica como solicitar a exclusão dos seus dados
              pessoais armazenados no Barboo.
            </p>
          </section>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-[#c7d2f2]">
            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                1. Direito de exclusão
              </h2>
              <p className="mt-3">
                Você pode solicitar a exclusão dos seus dados pessoais quando
                aplicável, conforme a legislação vigente.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                2. Como solicitar exclusão
              </h2>
              <p className="mt-3">
                A solicitação pode ser feita enviando um e-mail para
                `privacidade@barboo.com.br` ou por meio do suporte oficial da
                plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                3. Dados que podem ser excluídos
              </h2>
              <p className="mt-3">
                A depender do caso, podemos remover:
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5">
                <li>Informações de conta.</li>
                <li>Histórico de agendamentos.</li>
                <li>Dados de perfil.</li>
                <li>Preferências associadas à conta.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                4. Prazo de processamento
              </h2>
              <p className="mt-3">
                As solicitações serão processadas dentro de um prazo razoável,
                conforme exigido por legislação aplicável.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                5. Confirmação
              </h2>
              <p className="mt-3">
                Você poderá receber uma confirmação quando o processo de
                exclusão for concluído.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}
