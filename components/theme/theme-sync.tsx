"use client";

import { useEffect, useState } from "react";
import {
  DASHBOARD_THEME_STORAGE_KEY,
  BOOKING_THEME_STORAGE_KEY,
  normalizeThemePreference,
  resolveTheme,
  type ThemePreference,
  type ResolvedTheme,
} from "@/lib/theme";

function applyResolved(theme: ResolvedTheme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "light" ? "#faf7fb" : "#0b0910");
  }
}

function readStored(key: string): ThemePreference | null {
  try {
    const v = localStorage.getItem(key);
    return v === "dark" || v === "light" || v === "system" ? v : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: ThemePreference) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function usePrefersDark() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const onChange = () => setDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return dark;
}

/** Keep <html data-theme> in sync for dashboard (account + localStorage). */
export function DashboardThemeSync({
  preference,
}: {
  preference: ThemePreference;
}) {
  const prefersDark = usePrefersDark();
  const [pref, setPref] = useState<ThemePreference>(() => preference);

  useEffect(() => {
    const stored = readStored(DASHBOARD_THEME_STORAGE_KEY);
    if (stored) setPref(stored);
    else setPref(normalizeThemePreference(preference));
  }, [preference]);

  useEffect(() => {
    applyResolved(resolveTheme(pref, prefersDark));
  }, [pref, prefersDark]);

  return null;
}

/** Public booking / client token pages: follow the tech's bookingTheme. */
export function BookingThemeSync({
  preference,
}: {
  preference: ThemePreference;
}) {
  const prefersDark = usePrefersDark();
  const pref = normalizeThemePreference(preference);

  useEffect(() => {
    writeStored(BOOKING_THEME_STORAGE_KEY, pref);
    applyResolved(resolveTheme(pref, prefersDark));
  }, [pref, prefersDark]);

  return null;
}

export function setDashboardThemePreference(next: ThemePreference) {
  writeStored(DASHBOARD_THEME_STORAGE_KEY, next);
  const dark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyResolved(resolveTheme(next, dark));
}
