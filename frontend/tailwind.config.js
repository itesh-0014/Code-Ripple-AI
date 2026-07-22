/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0f0d',
        panel: '#111714',
        line: '#243029',
        signal: '#b8f34a',
        mint: '#65d9a5',
        sand: '#f4f2e9',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 24px 70px rgba(0, 0, 0, 0.22)',
      },
    },
  },
  plugins: [],
};
