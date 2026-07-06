import { RemoteImage } from "@/components/ui/remote-image";

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Service photos are often square before/after composites. Show the full
 * uploaded image at its natural aspect ratio — never crop to one half.
 */
export function ServicePhoto({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className="w-full shrink-0 overflow-hidden bg-cream">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        className={cn("block h-auto w-full", className)}
      />
    </div>
  );
}

/** Profile avatar — fit the full image inside the frame without cropping. */
export function AvatarPhoto({ src, alt }: { src: string; alt: string }) {
  return (
    <RemoteImage
      src={src}
      alt={alt}
      fill
      fit="contain"
      className="p-0.5"
    />
  );
}

/** Hero cover — show the full photo; letterbox if the upload is square. */
export function HeroPhoto({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <RemoteImage
      src={src}
      alt={alt}
      fill
      fit="contain"
      className={className}
    />
  );
}
