/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          fuchsia: '#FF00C8',
          'fuchsia-600': '#FF0099'
        },
        neon: {
          green: '#C7FF00',
          amber: '#FFD400'
        }
      },
      boxShadow: {
        'neon-fuchsia': '0 8px 30px rgba(255,0,200,0.18)'
      }
    },
  },
  plugins: [],
}
