import Image from "next/image";

type HeroHeadingProps = {
  titleStart: string;
  highlight: string;
  titleEnd: string;
  subtitle: string;
  logoSrc?: string;
  logoAlt?: string;
};

export function HeroHeading({
  titleStart,
  highlight,
  titleEnd,
  subtitle,
  logoSrc = "/next.svg",
  logoAlt = "Barboo",
}: HeroHeadingProps) {
  return (
    <div className="mx-auto max-w-4xl text-center">
      <Image
        src={logoSrc}
        alt={logoAlt}
        width={460}
        height={120}
        priority
        className="
          mx-auto mb-6
          w-[270px]
          md:w-[350px]
          lg:w-[410px]
          h-auto
          drop-shadow-[0_10px_25px_rgba(0,0,0,0.35)]
        "
      />

    <h1 className="text-balance font-extrabold tracking-[-0.03em] leading-[1.02] text-[#f1f2f7] [text-shadow:0_6px_22px_rgba(0,0,0,0.55)] text-4xl md:text-5xl lg:text-6xl">
      {titleStart}{" "}
      <span className="text-[#2b67e0] drop-shadow-[0_0_14px_rgba(43,103,224,0.35)]">
        {highlight}
      </span>{" "}
      {titleEnd}
    </h1>

    <p className="mx-auto mt-4 max-w-2xl text-pretty text-[15px] md:text-[17px] leading-relaxed text-[#9aa0b8]">
      {subtitle}
    </p>
    </div>
  );
}
