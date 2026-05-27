import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // NGU brand — kept from the original repo
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
          'orange-hover': '#d96a18',
        },

        // Semantic tokens that read from CSS variables (allows light/dark)
        surface:   'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        border:    'var(--border)',
        'border-strong': 'var(--border-strong)',

        ink:       'var(--text)',
        'ink-2':   'var(--text-2)',
        'ink-muted':  'var(--text-muted)',
        'ink-subtle': 'var(--text-subtle)',

        // Status — read from CSS vars too
        'status-new':       'var(--info)',
        'status-active':    'var(--ok)',
        'status-submitted': 'var(--warn)',
        'status-bad':       'var(--bad)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '10px',
        lg: '14px',
      },
      animation: {
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
