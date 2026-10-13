import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#080F0C",
        sidebar: "#0C1712",
        card: "#13231B",
        panel: "#13231B",
        border: "#243E30",
        accent: {
          DEFAULT: "#00FF9D",
          hover: "#00E08A",
        },
        navActive: "#173325",
        warning: "#FFB800",
        danger: "#FF2E63",
        success: "#00FF9D",
        chartSecondary: "#8DA99A",
        // Vibrant Cyber Neons
        neon: {
          cyan: "#00F0FF",
          emerald: "#00FF9D",
          violet: "#B026FF",
          amber: "#FFB800",
          rose: "#FF2E63",
          blue: "#38BDF8",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.4)",
        glow: "0 0 20px -3px rgba(0, 255, 157, 0.35)",
        glowLg: "0 0 35px -5px rgba(0, 255, 157, 0.5)",
        glowCyan: "0 0 25px -3px rgba(0, 240, 255, 0.45)",
        glowViolet: "0 0 25px -3px rgba(176, 38, 255, 0.45)",
        glowRose: "0 0 25px -3px rgba(255, 46, 99, 0.45)",
        glowAmber: "0 0 25px -3px rgba(255, 184, 0, 0.45)",
        neon: "0 0 15px rgba(0, 255, 157, 0.5), inset 0 0 15px rgba(0, 255, 157, 0.2)",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        pulseSlow: "pulseSlow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        scanline: "scanline 8s linear infinite",
        shimmer: "shimmer 2.5s infinite",
        laserScan: "laserScan 3s ease-in-out infinite alternate",
        spinSlow: "spin 20s linear infinite",
        aurora: "aurora 10s ease infinite alternate",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        pulseSlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(1000%)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        laserScan: {
          "0%": { transform: "translateY(-100%)", opacity: "0.2" },
          "50%": { opacity: "0.9" },
          "100%": { transform: "translateY(100%)", opacity: "0.2" },
        },
        aurora: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
      backdropBlur: {
        glass: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
