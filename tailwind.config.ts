import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    translate: {
      full: "100%",
    },
    animation: {
      rocketLaunch: "rocketLaunch 3s cubic-bezier(0.2, 0.9, 0.3, 1.1) forwards",
      rocketLanding:
        "rocketLanding 5s cubic-bezier(0.2, 0.9, 0.3, 1.0) forwards",
    },
    keyframes: {
      rocketLaunch: {
        "0%": { transform: "translateY(0) scale(1)", opacity: "1" },
        "60%": { transform: "translateY(-38%) scale(0.96)", opacity: "1" },
        "100%": { transform: "translateY(-275%) scale(0.9)", opacity: "0" },
      },
      rocketLanding: {
        "0%": { transform: "translateY(-72%) scale(0.9)", opacity: "0.92" },
        "70%": { transform: "translateY(4%) scale(0.98)", opacity: "1" },
        "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
      },
    },
  },
  plugins: [],
} satisfies Config;
