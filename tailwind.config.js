/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        ink: {
          900: "#15120e",
          800: "#1d1914",
          700: "#272019",
          600: "#332a20",
          500: "#4a3d2e",
        },
        paper: {
          50: "#fbf3df",
          100: "#f5e9c8",
          200: "#ecd9a8",
          300: "#e0c788",
        },
        cinnabar: {
          400: "#d94838",
          500: "#c0392b",
          600: "#a32a1e",
          700: "#82201a",
        },
        gold: {
          300: "#e3c878",
          400: "#d4af52",
          500: "#c9a961",
          600: "#a8884a",
        },
        jade: {
          300: "#7ec4a8",
          400: "#5d8a7a",
          500: "#3f6b5c",
        },
      },
      fontFamily: {
        kai: ['"Ma Shan Zheng"', '"STKaiti"', '"KaiTi"', '"楷体"', 'serif'],
        serif: ['"Noto Serif SC"', '"Songti SC"', '"SimSun"', '"宋体"', 'serif'],
        display: ['"ZCOOL XiaoWei"', '"Noto Serif SC"', 'serif'],
      },
      boxShadow: {
        piece: "0 3px 6px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.6)",
        "piece-red": "0 3px 8px rgba(140,30,20,0.45), inset 0 1px 2px rgba(255,255,255,0.5)",
        board: "0 18px 50px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.4)",
        panel: "0 8px 30px rgba(0,0,0,0.4)",
      },
      keyframes: {
        "pop-in": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "70%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "pulse-ring": {
          "0%, 100%": { opacity: "0.9", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(1.12)" },
        },
      },
      animation: {
        "pop-in": "pop-in 0.25s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "pulse-ring": "pulse-ring 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
