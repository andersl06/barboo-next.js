import { PremiumBackground } from "@/components/background"
import { FeatureCard } from "@/components/ui/FeatureCard"
import { HeroHeading } from "@/components/ui/HeroHeading"
import { UIButton } from "@/components/ui/UIButton"

export default function Home() {
  return (
    <main className="relative min-h-[100svh] overflow-x-hidden bg-[#070B16] px-4 py-10 md:px-8 md:py-14">
      <PremiumBackground />

      <section className="relative z-10 mx-auto w-full max-w-7xl">
        <div className="mb-10 flex justify-end gap-3">
          <UIButton variant="secondary" href="/login">Login</UIButton>
          <UIButton variant="primary" href="/cadastro">Cadastre-se</UIButton>
        </div>

        <HeroHeading
          logoSrc="/assets/brand/barboo_logo.png"
          logoAlt="Barboo"
          titleStart="Conectando"
          highlight="barbeiros"
          titleEnd="e clientes."
          subtitle="Tenha controle da sua barbearia ou encontre profissionais e horarios com rapidez em uma experiencia moderna e intuitiva."
        />

        <div className="mt-10 grid grid-cols-1 gap-5 md:mt-12 md:grid-cols-3 md:gap-6">
          <FeatureCard
            title="Sou Proprietario"
            description="Cadastre-se para gerenciar sua barbearia e atrair mais clientes para o seu negocio."
            iconSrc="/assets/icons/file.png"
            ctaLabel="Comecar"
            ctaVariant="secondary"
            ctaHref="/cadastro/proprietario"
          />

          <FeatureCard
            title="Sou Cliente"
            description="Agende cortes e encontre a barbearia ideal para voce com poucos toques."
            iconSrc="/assets/icons/user.png"
            ctaLabel="Criar Conta"
            ctaVariant="primary"
            ctaHref="/cadastro/cliente"
          />

          <FeatureCard
            title="Encontrar Barbearias"
            description="Busque barbearias proximas e marque seu horario de forma simples e rapida."
            iconSrc="/assets/icons/location.png"
            ctaLabel="Pesquisar"
            ctaVariant="primary"
            floatingIllustrationSrc="/assets/icons/barberpole.png"
            floatingIllustrationAlt="Barber pole"
          />
        </div>
      </section>
    </main>
  )
}
