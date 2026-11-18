import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: 'rgb(var(--parchment-50) / <alpha-value>)',
          100: 'rgb(var(--parchment-100) / <alpha-value>)',
          200: 'rgb(var(--parchment-200) / <alpha-value>)',
          300: 'rgb(var(--parchment-300) / <alpha-value>)',
        },
        dungeon: {
          900: 'rgb(var(--dungeon-900) / <alpha-value>)',
          800: 'rgb(var(--dungeon-800) / <alpha-value>)',
          700: 'rgb(var(--dungeon-700) / <alpha-value>)',
          600: 'rgb(var(--dungeon-600) / <alpha-value>)',
          500: 'rgb(var(--dungeon-500) / <alpha-value>)',
        },
        ember: {
          400: 'rgb(var(--ember-400) / <alpha-value>)',
          500: 'rgb(var(--ember-500) / <alpha-value>)',
          600: 'rgb(var(--ember-600) / <alpha-value>)',
        },
        hp: {
          500: 'rgb(var(--hp-500) / <alpha-value>)',
        },
        mana: {
          500: 'rgb(var(--mana-500) / <alpha-value>)',
        },
        good: {
          500: 'rgb(var(--good-500) / <alpha-value>)',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        parchment: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
