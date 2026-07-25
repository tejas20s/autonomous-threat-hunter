/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        critical: { DEFAULT: '#dc2626', light: '#fca5a5', dark: '#991b1b' },
        high: { DEFAULT: '#ea580c', light: '#fdba74', dark: '#9a3412' },
        medium: { DEFAULT: '#ca8a04', light: '#fde047', dark: '#854d0e' },
        low: { DEFAULT: '#16a34a', light: '#86efac', dark: '#166534' },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
