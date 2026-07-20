import { themeBootScript, type ThemePreference } from "@/lib/theme";

/** Tiny inline script so data-theme is set before paint (no flicker). */
export function ThemeBootScript({
  storageKey,
  preference = "system",
}: {
  storageKey: string;
  preference?: ThemePreference;
}) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: themeBootScript(storageKey, preference),
      }}
    />
  );
}
