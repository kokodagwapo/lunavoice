/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        luna: {
          bg: '#F5F5F5',
          surface: 'rgba(255, 255, 255, 0.7)',
          glass: 'rgba(255, 255, 255, 0.5)',
          border: 'rgba(0, 0, 0, 0.06)',
          text: '#1a1a1a',
          muted: '#6b7280',
          accent: '#0EA5E9',
        }
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 4px 24px rgba(0, 0, 0, 0.04)',
        'glass-lg': '0 8px 32px rgba(0, 0, 0, 0.06)',
        'inner-glass': 'inset 0 1px 1px rgba(255, 255, 255, 0.8)',
      }
    },
  },
  plugins: [],
}
