import { PremiumBackground } from "@/components/background"
import { UIButton } from "@/components/ui/UIButton"

const LAST_UPDATED = "Março de 2026"

export default function TermsOfServicePage() {
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
              Termos de Serviço
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
              Estes Termos de Serviço regulam o uso da plataforma Barboo.
              Ao acessar ou utilizar o Barboo, você concorda com as condições
              descritas abaixo.
            </p>
          </section>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-[#c7d2f2]">
            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                1. Introdução
              </h2>
              <p className="mt-3">
                O Barboo é uma plataforma para agendamento e gestão de serviços
                de barbearia, conectando clientes, barbeiros e proprietários de
                barbearias.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                2. Aceitação dos Termos
              </h2>
              <p className="mt-3">
                Ao utilizar o Barboo, você declara que leu, entendeu e concorda
                com estes Termos de Serviço.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                3. Contas de usuário
              </h2>
              <p className="mt-3">
                É possível criar conta como cliente, barbeiro ou proprietário de
                barbearia. Você é responsável por fornecer informações corretas
                e manter a segurança de sua conta.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                4. Uso da plataforma
              </h2>
              <p className="mt-3">
                A plataforma permite:
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5">
                <li>Agendamentos de serviços.</li>
                <li>Gestão de agenda e disponibilidade.</li>
                <li>Comunicação relacionada aos serviços.</li>
                <li>Pagamentos, quando aplicável.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                5. Responsabilidades do usuário
              </h2>
              <p className="mt-3">
                O usuário é responsável pelas informações fornecidas e pelo uso
                adequado da plataforma, respeitando a legislação vigente e os
                direitos de terceiros.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                6. Pagamentos
              </h2>
              <p className="mt-3">
                Pagamentos podem ser processados por serviços de terceiros, como
                gateways de pagamento via Pix, quando aplicável.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                7. Limitações de responsabilidade
              </h2>
              <p className="mt-3">
                O Barboo fornece a plataforma para facilitar agendamentos e
                gestão. A execução dos serviços é de responsabilidade das
                barbearias e profissionais.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                8. Alterações nos termos
              </h2>
              <p className="mt-3">
                O Barboo pode atualizar estes Termos periodicamente. Quando isso
                ocorrer, a data de "Última atualização" será revisada nesta
                página.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                9. Contato
              </h2>
              <p className="mt-3">
                Para dúvidas legais ou de suporte, entre em contato pelo e-mail
                `privacidade@barboo.com.br` ou pelo suporte oficial da
                plataforma.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}
