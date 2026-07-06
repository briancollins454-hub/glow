import Image from "next/image";

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Signed Supabase storage image with lazy loading and sizing. */
export function RemoteImage({
  src,
  alt,
  className,
  width,
  height,
  fill,
  sizes,
  fit = "cover",
  position = "center",
}: {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  fit?: "cover" | "contain";
  position?: string;
}) {
  const fitClass = fit === "contain" ? "object-contain" : "object-cover";

  // Fill mode uses a plain <img> so object-fit is reliable inside aspect-ratio
  // boxes. Next.js Image fill adds a wrapper span that can mis-size on flex/aspect
  // layouts and show repeated or clipped artwork on some mobile browsers.
  if (fill) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        className={cn(
          "absolute inset-0 block h-full w-full max-w-none",
          fitClass,
          className,
        )}
        style={{ objectPosition: position }}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 64}
      height={height ?? 64}
      className={cn(fitClass, className)}
      style={{ objectPosition: position }}
      sizes={sizes}
      unoptimized
    />
  );
}
