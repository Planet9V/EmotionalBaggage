import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg-canvas)",
        surface: "var(--bg-surface)",
        subtle: "var(--bg-subtle)",
        bezel: "var(--bezel-shell)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        hairline: "var(--border-hairline)",
        background: "var(--bg-canvas)",
        foreground: "var(--text-primary)",
        obsidian: "#0b0c0e",
        charcoalBand: "#121417",
        slateBand: "#16181d",
        cardSurface: "#131519",
        cardBorder: "#22252c",
        // Contrast tokens (polish A3), set per theme in globals.css. No opacity modifiers on these.
        action: { DEFAULT: "var(--action-bg)", hover: "var(--action-bg-hover)" },
        link: "var(--link)",
        focus: "var(--focus-ring)",
        // Status tokens (admin polish 2), set per theme in globals.css. No opacity modifiers on these.
        danger: { DEFAULT: "var(--danger)", soft: "var(--danger-soft)", solid: "var(--danger-solid)" },
        success: { DEFAULT: "var(--success)", soft: "var(--success-soft)" },
        warning: { DEFAULT: "var(--warning)", soft: "var(--warning-soft)" },
        info: { DEFAULT: "var(--info)", soft: "var(--info-soft)" },
        dutchOrange: {
          DEFAULT: "#E05A10",
          50: "#FFF6EF",
          100: "#FFE7D6",
          200: "#FFC9A8",
          300: "#FFA370",
          400: "#F07B37",
          500: "#E05A10",
          600: "#C64405",
          700: "#9C3204",
          800: "#7A2A0A",
          900: "#63240C",
        },
        charcoal: {
          DEFAULT: "#0b0c0e",
          50: "#18181b",
          100: "#121417",
          200: "#0d0d0f",
          300: "#09090b",
          400: "#050505",
          500: "#0b0c0e",
          600: "#000000",
        },
      },
      fontFamily: {
        serif: ["Charter", "Bitstream Charter", "Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      // Display scale for landing-page headings. Fluid, tight leading and tracking.
      // display-2: the one deliberate large moment per page (never above 3rem, so it stays
      // near the shared hero h1); display-3: section titles (capped at the hero h1 size, 2.25rem).
      fontSize: {
        "display-2": ["clamp(2rem, 1.45rem + 1.9vw, 3rem)", { lineHeight: "1.06", letterSpacing: "-0.03em", fontWeight: "600" }],
        "display-3": ["clamp(1.625rem, 1.3rem + 1.1vw, 2.25rem)", { lineHeight: "1.12", letterSpacing: "-0.025em", fontWeight: "600" }],
      },
      transitionTimingFunction: {
        spring: "var(--ease-spring)",
        "out-soft": "var(--ease-out)",
      },
      boxShadow: {
        plate: "var(--shadow-plate)",
        "bezel-inset": "inset 0 1px 0 0 var(--bezel-highlight)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 6s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 15px rgba(224, 90, 16, 0.3)" },
          "100%": { boxShadow: "0 0 25px rgba(224, 90, 16, 0.6)" },
        },
      },
    },
  },
  plugins: [
    plugin(function ({ addVariant }) {
      addVariant("light", "html.light &");
      // Hover effects only for mouse-type pointers, so a tap never leaves a card stuck in its hover state.
      addVariant("can-hover", "@media (hover: hover) and (pointer: fine)");
    }),
  ],
};

export default config;
