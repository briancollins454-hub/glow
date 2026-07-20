import { ThemeBootScript } from "@/components/theme/theme-boot-script";
import { BookingThemeSync, DashboardThemeSync } from "@/components/theme/theme-sync";
import {
  BOOKING_THEME_STORAGE_KEY,
  normalizeThemePreference,
} from "@/lib/theme";

/** Applies the tech's booking-page theme (public + client token pages). */
export function PublicBookingTheme({ preference }: { preference?: string | null }) {
  const pref = normalizeThemePreference(preference);
  return (
    <>
      <ThemeBootScript storageKey={BOOKING_THEME_STORAGE_KEY} preference={pref} />
      <BookingThemeSync preference={pref} />
    </>
  );
}

export function DashboardTheme({ preference }: { preference?: string | null }) {
  return <DashboardThemeSync preference={normalizeThemePreference(preference)} />;
}
