import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fixed pink scale (same in both themes). brand-600 === --brand.
        brand: {
          50: "#fdf2f8",
          100: "#fce7f3",
          200: "#fbcfe8",
          300: "#f9a8d4",
          400: "#f472b6",
          500: "#ec4899",
          600: "#db2777",
          700: "#be185d",
          800: "#9d174d",
          900: "#831843",
        },
        // Semantic tokens — values come from data-theme CSS variables.
        // cream keeps historical class names (page background).
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          soft: "rgb(var(--ink-soft-rgb) / <alpha-value>)",
          faint: "rgb(var(--ink-faint-rgb) / <alpha-value>)",
        },
        cream: "rgb(var(--bg-rgb) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--surface-rgb) / <alpha-value>)",
          raised: "rgb(var(--surface-raised-rgb) / <alpha-value>)",
        },
        // Themed border colour (alpha baked into --edge per theme).
        edge: "var(--edge)",
        fill: {
          DEFAULT: "var(--fill)",
          hover: "var(--fill-hover)",
        },
        overlay: "var(--overlay)",
        "on-brand": "var(--on-brand)",
        canvas: "var(--canvas-fallback)",
        "brand-soft": "var(--brand-soft)",
        "brand-text": "var(--brand-text)",
        "success-soft": "var(--success-soft)",
        "success-text": "var(--success-text)",
        "warning-soft": "var(--warning-soft)",
        "warning-text": "var(--warning-text)",
        "danger-soft": "var(--danger-soft)",
        "danger-text": "var(--danger-text)",
        "info-soft": "var(--info-soft)",
        "info-text": "var(--info-text)",
        "pending-soft": "var(--pending-soft)",
        "pending-text": "var(--pending-text)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        glow: "var(--shadow-glow)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
    },
  },
};

export default config;
