import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1a3a5c',
          50:  '#e8f0fe',
          100: '#c5d8f5',
          200: '#9bbde8',
          300: '#6fa2db',
          400: '#4a8dcf',
          500: '#2a78c2',
          600: '#1a3a5c',
          700: '#0d2137',
          800: '#071524',
          900: '#030b12',
        },
        brand: {
          orange: '#e87722',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
