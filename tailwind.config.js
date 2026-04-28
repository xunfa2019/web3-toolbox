/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#eef2ff', 100: '#e0e7ff', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' },
        dark: { 800: '#1e1e2e', 900: '#11111b', 950: '#0a0a14' },
        surface: { 100: '#2a2a3e', 200: '#242438', 300: '#1e1e30' },
      },
    },
  },
  plugins: [],
}
