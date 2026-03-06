import Image from "next/image"
import { UIButton } from "./UIButton"

type FeatureCardProps = {
  title: string
  description?: string
  iconSrc?: string
  ctaLabel: string
  ctaVariant: "primary" | "secondary"
  ctaHref?: string
  onCtaClick?: () => void
  floatingIllustrationSrc?: string
  floatingIllustrationAlt?: string
}

export function FeatureCard({
  title,
  description,
  iconSrc,
  ctaLabel,
  ctaVariant,
  ctaHref,
  onCtaClick,
  floatingIllustrationSrc,
  floatingIllustrationAlt = "Ilustracao",
}: FeatureCardProps) {
  return (
    <article className="group relative w-full min-h-[320px] overflow-visible rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(19,20,58,0.92)_0%,rgba(14,16,54,0.88)_55%,rgba(20,23,51,0.93)_100%)] p-6 text-[#f1f2f7] shadow-[0_20px_60px_rgba(0,0,0,0.55)] ring-1 ring-white/5 backdrop-blur-md before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:bg-[radial-gradient(120%_80%_at_0%_0%,rgba(255,255,255,0.16),transparent_45%)] before:opacity-70 after:pointer-events-none after:absolute after:inset-0 after:rounded-2xl after:bg-[radial-gradient(120%_75%_at_60%_100%,rgba(0,0,0,0.42),transparent_50%)]">
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.08] mix-blend-screen [background-image:radial-gradient(rgba(255,255,255,0.8)_0.7px,transparent_0.7px)] [background-size:3px_3px]" />

      <div className="relative z-10 flex h-full flex-col">
        <header className="flex items-center gap-4 border-b border-white/10 pb-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl md:h-[72px] md:w-[72px]">
            {iconSrc ? (
              <Image
                src={iconSrc}
                alt=""
                fill
                sizes="72px"
                className="object-cover object-center drop-shadow-[0_10px_22px_rgba(0,0,0,0.45)]"
              />
            ) : (
              <div className="h-full w-full rounded-xl bg-white/10" />
            )}
          </div>

          <h3 className="text-[22px] font-semibold tracking-[-0.015em] text-[#f1f2f7]">
            {title}
          </h3>
        </header>

        <section className="mt-5 space-y-3">
          {description ? (
            <p className="text-[16px] leading-relaxed text-[#9aa0b8]">
              {description}
            </p>
          ) : (
            <>
              <div className="h-3 rounded-full bg-white/12" />
              <div className="h-3 w-11/12 rounded-full bg-white/10" />
              <div className="h-3 w-8/12 rounded-full bg-white/10" />
            </>
          )}
        </section>

        <footer className="mt-auto pt-6">
          {ctaHref ? (
            <UIButton variant={ctaVariant} href={ctaHref}>
              {ctaLabel}
            </UIButton>
          ) : (
            <UIButton variant={ctaVariant} onClick={onCtaClick}>
              {ctaLabel}
            </UIButton>
          )}
        </footer>
      </div>

      {floatingIllustrationSrc ? (
        <div className="pointer-events-none absolute -right-10 bottom-[-6px] z-20 hidden md:block">
          <Image
            src={floatingIllustrationSrc}
            alt={floatingIllustrationAlt}
            width={160}
            height={320}
            className="h-auto w-[135px] object-contain drop-shadow-[0_18px_35px_rgba(0,0,0,0.6)] lg:w-[150px]"
          />
        </div>
      ) : null}
    </article>
  )
}
