import Image from "next/image";

/** Signed Supabase storage image with lazy loading and sizing. */
export function RemoteImage({
  src,
  alt,
  className,
  width,
  height,
  fill,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
}) {
  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        sizes={sizes ?? "100vw"}
        unoptimized
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 64}
      height={height ?? 64}
      className={className}
      unoptimized
    />
  );
}
