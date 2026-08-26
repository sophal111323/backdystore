/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Baloo 2"', "system-ui", "sans-serif"],
        sans: ['"Nunito"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        pink: {
          50:  "#FFF0F6",
          100: "#FFE4F0",
          200: "#FFB3D1",
          300: "#FF90C0",
          400: "#FF6EB4",
          500: "#E91E8C",
          600: "#C2185B",
          700: "#9C4070",
          800: "#3D0020",
          900: "#1A000D",
        },
        fox: {
          bg:      "#FFF0F6",
          surface: "#FFE4F0",
          card:    "#FFFFFF",
          border:  "#FFB3D1",
          primary: "#E91E8C",
          accent:  "#FF6EB4",
          gold:    "#FFB3D1",
          text:    "#3D0020",
          muted:   "#9C4070",
        },
      },
      boxShadow: {
        "glow-sm":    "0 0 12px rgba(233,30,140,0.30)",
        "glow":       "0 0 30px rgba(233,30,140,0.40)",
        "glow-lg":    "0 0 60px rgba(233,30,140,0.50)",
        "inner-glow": "inset 0 0 24px rgba(233,30,140,0.20)",
        "pink-card":  "0 4px 24px rgba(233,30,140,0.12)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "pink-hero": "linear-gradient(135deg,#F06292 0%,#E91E8C 50%,#C2185B 100%)",
        "pink-soft": "linear-gradient(135deg,#FFE4F0 0%,#FFCCE5 100%)",
      },
      animation: {
        float:        "float 6s ease-in-out infinite",
        "float-slow": "float-slow 9s ease-in-out infinite",
        shine:        "shine 3s linear infinite",
        marquee:      "marquee 35s linear infinite",
        "fade-up":    "fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in":    "fade-in 0.5s ease-out both",
        "pulse-ring": "pulse-ring 2.2s cubic-bezier(0.215,0.61,0.355,1) infinite",
        shimmer:      "shimmer-sweep 2.8s ease-in-out infinite",
      },
      keyframes: {
        float:        { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        "float-slow": { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-14px)" } },
        shine:        { to: { "background-position": "200% center" } },
        marquee:      { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        "fade-up":    { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "fade-in":    { from: { opacity: "0" }, to: { opacity: "1" } },
        "pulse-ring": {
          "0%":      { transform: "scale(0.8)", opacity: "0.7" },
          "80%,100%":{ transform: "scale(2.2)", opacity: "0"   },
        },
      },
    },
  },
  plugins: [],
};
