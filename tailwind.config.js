/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0f0d1a",
        surface: "#1a1730",
        "accent-gold": "#d4a843",
        "text-primary": "#e8e4f0",
        "text-secondary": "#9b93b0",
        border: "#2d2845",
      },
    },
  },
  plugins: [],
};
