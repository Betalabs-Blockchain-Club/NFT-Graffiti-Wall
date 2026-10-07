/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        graffiti: {
          dark: "#0b0c10",
          card: "#12141d",
          border: "#1f2438",
          neonPink: "#ff007f",
          neonCyan: "#00f0ff",
          neonGreen: "#39ff14",
          neonPurple: "#b026ff",
          neonYellow: "#ffe600",
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      keyframes: {
        glow: {
          '0%, 100%': { filter: 'drop-shadow(0 0 15px rgba(0, 240, 255, 0.6))' },
          '50%': { filter: 'drop-shadow(0 0 25px rgba(255, 0, 127, 0.8))' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.02)' },
        }
      },
      animation: {
        glow: 'glow 3s ease-in-out infinite',
        pulseGlow: 'pulseGlow 2.5s ease-in-out infinite',
      }
    },
  },
  plugins: [],
};
