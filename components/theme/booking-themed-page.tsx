import { PublicBookingTheme } from "@/components/theme/theme-providers";

/** Wrap a client-token / public page so it uses the tech's booking theme. */
export function BookingThemedPage({
  preference,
  children,
}: {
  preference?: string | null;
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicBookingTheme preference={preference} />
      {children}
    </>
  );
}
