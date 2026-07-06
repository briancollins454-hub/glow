import { RemoteImage } from "@/components/ui/remote-image";

/**
 * Service photos from techs are often square before/after composites (two shots
 * stacked in one file). A wide crop shows both halves and looks "tiled".
 * 2:1 + bottom anchor keeps the finished result (lower half) visible.
 */
export function ServicePhoto({
  src,
  alt,
  sizes = "(max-width: 640px) 100vw, 640px",
  className,
}: {
  src: string;
  alt: string;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className="relative aspect-[2/1] w-full shrink-0 overflow-hidden bg-cream">
      <RemoteImage
        src={src}
        alt={alt}
        fill
        position="center bottom"
        className={className}
        sizes={sizes}
      />
    </div>
  );
}

/** Small profile avatar — crops to the top half of square before/after uploads. */
export function AvatarPhoto({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className="absolute inset-x-0 top-0 h-[200%] w-full object-cover object-top"
    />
  );
}

/** Hero / banner photos — anchor to top so stacked duplicates don't double up. */
export function HeroPhoto({
  src,
  alt,
  sizes = "100vw",
  className,
  position = "center top",
}: {
  src: string;
  alt: string;
  sizes?: string;
  className?: string;
  position?: string;
}) {
  return (
    <RemoteImage
      src={src}
      alt={alt}
      fill
      position={position}
      className={className}
      sizes={sizes}
    />
  );
}
