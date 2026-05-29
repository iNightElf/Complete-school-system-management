/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        school: {
          primary: "#1a1a2e",
          secondary: "#16213e",
          accent: "#e94560",
          paper: "#f5f0e8",
        }
      }
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
}
