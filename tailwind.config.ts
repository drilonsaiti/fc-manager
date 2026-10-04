import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          50: "#f9f9f9", 100: "#f0f0f0", 200: "#e0e0e0",
          300: "#c0c0c0", 400: "#8a8a8a", 500: "#5a5a5a",
          600: "#3a3a3a", 700: "#2a2a2a", 800: "#1a1a1a",
          900: "#0d0d0d", 950: "#050505",
        },
      },
      fontFamily: {
        display: ["'Bebas Neue'", "sans-serif"],
      },
      animation: {
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
      },
      keyframes: {
        slideUp: { "0%": { transform: "translateY(12px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
      },
    },
  },
  plugins: [],
};
export default config;
