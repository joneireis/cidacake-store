/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF', // Azul escuro
        secondary: '#DC2626', // Vermelho
        accent: '#F59E0B', // Amarelo
        background: '#F9FAFB', // Cinza claro
      },
    },
  },
  plugins: [],
}