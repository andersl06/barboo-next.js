import { PremiumBackground } from "@/components/background"
import { UIButton } from "@/components/ui/UIButton"

const LAST_UPDATED = "8 de março de 2026"

export default function PrivacyPolicyPage() {
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
              Política de Privacidade
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
              Esta Política descreve como o Barboo coleta, usa e compartilha
              dados pessoais no funcionamento atual da plataforma. Nosso objetivo
              é ser transparente com você, de forma clara e acessível.
            </p>
          </section>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-[#c7d2f2]">
            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                1. Introdução
              </h2>
              <p className="mt-3">
                Ao utilizar o Barboo, você pode fornecer dados necessários para
                cadastro, agendamento, comunicação e pagamentos. Esta Política
                se aplica a clientes, proprietários e barbeiros.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                2. Dados coletados
              </h2>
              <p className="mt-3">
                O Barboo coleta os seguintes tipos de dados, conforme as funções
                do sistema:
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5">
                <li>
                  Cadastro de conta (cliente, proprietário e barbeiro): nome,
                  e-mail, telefone e senha. CPF pode ser informado de forma
                  opcional para proprietários e barbeiros.
                </li>
                <li>
                  Dados da barbearia (cadastro e gestão): nome, telefone,
                  endereço, número, bairro, cidade, estado, CEP, horários de
                  funcionamento, descrição, e-mail da barbearia, slug e, quando
                  fornecido, CNPJ ou CPF.
                </li>
                <li>
                  Dados de localização do cliente: localização aproximada para
                  exibir barbearias próximas (quando você permitir).
                </li>
                <li>
                  Dados de agendamento: serviços, valores, datas/horários,
                  status do agendamento, histórico de confirmações, cancelamentos
                  e relacionamentos entre cliente, barbeiro e barbearia.
                </li>
                <li>
                  Perfil do barbeiro: biografia, apelido e agenda semanal, além
                  de foto de perfil (avatar).
                </li>
                <li>
                  Arquivos de imagem: logo e capa da barbearia e avatar do
                  barbeiro.
                </li>
                <li>
                  Preferências e relações: barbearias favoritas.
                </li>
                <li>
                  Mensagens do WhatsApp: dados necessários para envio e
                  recebimento de mensagens relacionadas ao serviço.
                </li>
                <li>
                  Dados de cobrança: informações necessárias para pagamentos
                  via Pix e status das faturas.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                3. Como utilizamos os dados
              </h2>
              <ul className="mt-4 list-disc space-y-2 pl-5">
                <li>
                  Criar e gerenciar contas, autenticar acessos e manter sessões.
                </li>
                <li>
                  Permitir agendamentos, gestão de serviços e controle da
                  agenda de barbearias e barbeiros.
                </li>
                <li>
                  Enviar comunicações operacionais, incluindo confirmações via
                  WhatsApp e recuperação de senha por e-mail.
                </li>
                <li>
                  Processar cobranças e acompanhar o status de faturas.
                </li>
                <li>
                  Exibir barbearias próximas com base na localização do cliente.
                </li>
                <li>
                  Prevenir abuso e fraudes e garantir a segurança da plataforma.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                4. Compartilhamento de dados com terceiros
              </h2>
              <p className="mt-3">
                Para operar a plataforma, o Barboo pode compartilhar dados com
                prestadores de serviço essenciais, sempre na medida necessária:
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5">
                <li>
                  WhatsApp Business: envio e recebimento de mensagens.
                </li>
                <li>
                  Serviço de e-mail transacional: envio de e-mails, como recuperação
                  de senha.
                </li>
                <li>
                  Gateway de pagamento Pix: geração e consulta de cobranças.
                </li>
                <li>
                  Serviços de infraestrutura e armazenamento de dados, além de
                  serviços de validação e geolocalização de endereços.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                5. Armazenamento e segurança
              </h2>
              <p className="mt-3">
                O Barboo adota medidas técnicas e organizacionais apropriadas
                para proteger os dados pessoais contra acesso não autorizado,
                perda, alteração ou uso indevido.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                6. Cookies e tecnologias semelhantes
              </h2>
              <p className="mt-3">
                Utilizamos cookies para autenticação e manutenção de sessão. No
                momento, não há indicação de uso de cookies de publicidade ou
                rastreamento de terceiros.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                7. Direitos do usuário
              </h2>
              <p className="mt-3">
                Você pode solicitar acesso, correção, atualização ou exclusão
                dos seus dados pessoais. Esses pedidos devem ser encaminhados
                pelo canal oficial de suporte do Barboo.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                8. Retenção e exclusão de dados
              </h2>
              <p className="mt-3">
                Mantemos os dados pessoais pelo tempo necessário para cumprir as
                finalidades descritas nesta Política e obrigações legais. Quando
                possível, dados podem ser excluídos ou anonimizados mediante
                solicitação ou encerramento da conta.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#f4f6ff]">
                9. Contato
              </h2>
              <p className="mt-3">
                Para questões de privacidade, utilize o canal de suporte oficial
                do Barboo. Informações de contato atualizadas podem ser
                encontradas no site ou no aplicativo.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}
