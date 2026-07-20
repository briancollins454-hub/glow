import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import {
  THEME_TOKENS,
  contrastRatio,
  normalizeThemePreference,
  resolveTheme,
  themeBootScript,
} from "@/lib/theme";

const ROOT = join(__dirname, "..");

const ALLOW_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "coverage",
  "public",
]);

/** Email / PDF / print templates intentionally keep their own light palette. */
const ALLOW_FILES = [
  "lib/email.ts",
  "lib/notify.ts",
  "lib/rebooking.ts",
  "lib/password-reset.ts",
  "lib/waitlist.ts",
  "lib/onboarding.ts",
  "lib/evidence-pack.ts",
  "lib/tax-pack.ts",
  "lib/feature-list-pdf.ts",
  "lib/feature-list-content.ts",
  "lib/theme.ts",
  "app/globals.css",
  "tailwind.config.ts",
  "tests/theme-tokens.test.ts",
  "tests/no-hardcoded-colours.test.ts",
  "tests/brand.test.ts",
  "lib/booking/brand.ts",
  "app/manifest.ts",
  "app/global-error.tsx", // minimal shell outside the theme tree
];

/** Patterns that must not appear outside allowlisted files. */
const FORBIDDEN = [
  /bg-white\/\[0\.\d+\]/,
  /hover:bg-white\/\[0\.\d+\]/,
  /border-white\/(?:10|15|20)/,
  /bg-\[#0b0910\]/,
  /bg-\[#141019\]/,
  /bg-\[#faf7fb\]/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (ALLOW_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts|css)$/.test(name)) out.push(full);
  }
  return out;
}

describe("theme helpers", () => {
  it("normalises and resolves preferences", () => {
    expect(normalizeThemePreference("light")).toBe("light");
    expect(normalizeThemePreference("nope")).toBe("system");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("emits a boot script that sets data-theme", () => {
    const js = themeBootScript("glow-dashboard-theme", "dark");
    expect(js).toContain("data-theme");
    expect(js).toContain("glow-dashboard-theme");
  });
});

describe("WCAG contrast for semantic tokens", () => {
  for (const mode of ["dark", "light"] as const) {
    const t = THEME_TOKENS[mode];
    it(`${mode}: ink on bg >= 4.5`, () => {
      expect(contrastRatio(t.ink, t.bg)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${mode}: ink-soft on surface >= 4.5`, () => {
      expect(contrastRatio(t.inkSoft, t.surface)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${mode}: on-brand on brand >= 4.5`, () => {
      expect(contrastRatio(t.onBrand, t.brand)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${mode}: status text on soft badge >= 3`, () => {
      expect(contrastRatio(t.successText, t.successSoft)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t.warningText, t.warningSoft)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t.dangerText, t.dangerSoft)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t.infoText, t.infoSoft)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t.pendingText, t.pendingSoft)).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("no hardcoded colour utilities outside allowlist", () => {
  it("fails with a list when forbidden patterns remain", () => {
    const allow = new Set(ALLOW_FILES.map((f) => join(ROOT, f)));
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      if (allow.has(file)) continue;
      const rel = relative(ROOT, file);
      // Skip migration SQL and fixtures that need literal hex for brand tests
      if (rel.startsWith("supabase/") || rel.startsWith("tests/fixtures")) continue;
      const text = readFileSync(file, "utf8");
      for (const [i, line] of text.split("\n").entries()) {
        for (const re of FORBIDDEN) {
          if (re.test(line)) {
            hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
          }
        }
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
