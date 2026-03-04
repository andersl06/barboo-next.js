type BackgroundImageLayerProps = {
  mobileSrc: string;
  desktopSrc: string;
  className?: string;
};

export function BackgroundImageLayer({
  mobileSrc,
  desktopSrc,
  className,
}: BackgroundImageLayerProps) {
  return (
    <>
      <div
        className={`absolute inset-0 bg-cover bg-center bg-no-repeat md:hidden ${className ?? ""}`}
        style={{ backgroundImage: `url(${mobileSrc})` }}
      />

      <div
        className={`absolute inset-0 hidden bg-cover bg-center bg-no-repeat md:block ${className ?? ""}`}
        style={{ backgroundImage: `url(${desktopSrc})` }}
      />
    </>
  );
}
