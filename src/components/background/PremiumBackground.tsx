import { BackgroundImageLayer } from "./BackgroundImageLayer";

type PremiumBackgroundProps = {
  className?: string;
  mobileImageSrc?: string;
  desktopImageSrc?: string;
};

export function PremiumBackground({
  className,
  mobileImageSrc = "/assets/backgrounds/barboo-mobile.avif",
  desktopImageSrc = "/assets/backgrounds/barboo-desktop.avif",
}: PremiumBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 md:fixed ${className ?? ""}`}
    >
      <BackgroundImageLayer
        mobileSrc={mobileImageSrc}
        desktopSrc={desktopImageSrc}
        className="transform-gpu"
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_55%,rgba(2,6,23,0.28)_100%)]" />
    </div>
  );
}
