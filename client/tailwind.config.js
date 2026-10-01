/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderColor: {
        DEFAULT: '#2f2f35',
        subtle: '#161619',
        strong: '#1c1c1dff',
      },
      colors: {
        canvas: '#18181b',
        sidebar: '#0f1015',
        header: '#0f1015',
        surface: {
          DEFAULT: '#202024',
          hover: '#28282d',
          card: '#1f1f23',
          elevated: '#242429',
          bubble: '#25252a',
          input: '#0f1015',
        },
        edge: {
          subtle: '#161619',
          DEFAULT: '#2f2f35',
          strong: '#2c2c31ff',
        },
        mono: {
          50: '#fafafa',
          100: '#f4f4f6',
          200: '#e4e4e8',
          300: '#d1d4de',
          400: '#b0b4c6',
          500: '#858a9e',
          600: '#62677a',
          700: '#484b5c',
          800: '#333644',
          900: '#272935',
          950: '#1e2026',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', 'Consolas', '"Liberation Mono"', 'Menlo', 'monospace'],
      }
    }
  },
  plugins: [],
};