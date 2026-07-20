/**
 * Theme preferences for dashboard chrome and public booking / client pages.
 * "system" follows prefers-color-scheme (dark when no preference).
 */
export type ThemePreference = "system" | "dark" | "light";

export type ResolvedTheme = "dark" | "light";

export const THEME_PREFERENCES: ThemePreference[] = ["system", "dark", "light"];

export const DASHBOARD_THEME_STORAGE_KEY = "glow-dashboard-theme";
export const BOOKING_THEME_STORAGE_KEY = "glow-booking-theme";

export const THEME_BG = {
  dark: "#0b0910",
  light: "#faf7fb",
} as const;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "dark" || value === "light";
}

export function normalizeThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : "system";
}

/** Resolve system/dark/light to a concrete theme. */
export function resolveTheme(
  preference: ThemePreference,
  prefersDark = true,
): ResolvedTheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return prefersDark ? "dark" : "light";
}

/**
 * Inline boot script: set data-theme before paint to avoid a flash.
 * `storageKey` chooses dashboard vs booking preference in localStorage.
 * `serverPreference` is the account default when localStorage is empty.
 */
export function themeBootScript(
  storageKey: string,
  serverPreference: ThemePreference = "system",
): string {
  const pref = JSON.stringify(normalizeThemePreference(serverPreference));
  const key = JSON.stringify(storageKey);
  return `(function(){try{var k=${key};var s=${pref};var v=localStorage.getItem(k);if(v==="dark"||v==="light"||v==="system")s=v;var dark=true;try{dark=window.matchMedia("(prefers-color-scheme: dark)").matches;}catch(e){}var t=s==="light"?"light":s==="dark"?"dark":(dark?"dark":"light");document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="light"?"#faf7fb":"#0b0910");}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;
}

/** Contrast ratio of two sRGB hex colours (WCAG). */
export function contrastRatio(hexA: string, hexB: string): number {
  const L = (hex: string) => {
    const n = hex.replace("#", "");
    const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const a = L(hexA);
  const b = L(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Token tables used by contrast tests and docs. */
export const THEME_TOKENS = {
  dark: {
    bg: "#0b0910",
    surface: "#141019",
    surfaceRaised: "#1b1523",
    ink: "#f2eef6",
    inkSoft: "#b3a9bf",
    inkFaint: "#7d7389",
    brand: "#db2777",
    brandStrong: "#be185d",
    brandText: "#f9a8d4",
    onBrand: "#ffffff",
    successSoft: "#064e3b",
    successText: "#6ee7b7",
    warningSoft: "#78350f",
    warningText: "#fcd34d",
    dangerSoft: "#7f1d1d",
    dangerText: "#fca5a5",
    infoSoft: "#0c4a6e",
    infoText: "#7dd3fc",
    pendingSoft: "#4c1d95",
    pendingText: "#c4b5fd",
  },
  light: {
    bg: "#faf7fb",
    surface: "#ffffff",
    surfaceRaised: "#ffffff",
    ink: "#1f1726",
    inkSoft: "#564a5e",
    inkFaint: "#8a7f91",
    brand: "#db2777",
    brandStrong: "#be185d",
    brandText: "#be185d",
    onBrand: "#ffffff",
    successSoft: "#ecfdf5",
    successText: "#047857",
    warningSoft: "#fffbeb",
    warningText: "#b45309",
    dangerSoft: "#fef2f2",
    dangerText: "#b91c1c",
    infoSoft: "#f0f9ff",
    infoText: "#0369a1",
    pendingSoft: "#f5f3ff",
    pendingText: "#6d28d9",
  },
} as const;
