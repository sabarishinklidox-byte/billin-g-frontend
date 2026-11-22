/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          red: 'var(--brand-red)',
          deep: 'var(--brand-red-dark)',
          black: 'var(--brand-black)',
          paper: 'var(--brand-paper)',
          line: 'var(--brand-line)',
        },
      },
    },
  },
  plugins: [],
}
