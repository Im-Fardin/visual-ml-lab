import type { Config } from 'tailwindcss'

export default <Config>{
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './composables/**/*.{js,ts}',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue'
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        card: {
          DEFAULT: 'var(--card)',
          subtle: 'var(--card-subtle)',
        },
        stage: 'var(--stage)',
        code: 'var(--code)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: {
          DEFAULT: 'var(--line)',
          strong: 'var(--line-strong)',
        },
        brand: {
          blue: {
            DEFAULT: 'var(--blue)',
            hover: 'var(--blue-hover)',
            soft: 'var(--blue-soft)',
          },
          amber: {
            DEFAULT: 'var(--amber)',
            hover: 'var(--amber-hover)',
            soft: 'var(--amber-soft)',
          },
          green: {
            DEFAULT: 'var(--green)',
            soft: 'var(--green-soft)',
          },
          red: {
            DEFAULT: 'var(--red)',
            soft: 'var(--red-soft)',
          },
          purple: {
            DEFAULT: 'var(--purple)',
            soft: 'var(--purple-soft)',
          },
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
}

