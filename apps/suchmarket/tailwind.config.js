/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Keep in sync with :root in globals.css
        ink: '#1c1917',
        paper: '#fff8f1',
        mist: '#ffedd5',
        line: '#fdba74',
        mute: '#57534e',
        soft: '#78716c',
        orange: {
          DEFAULT: '#ea580c',
          deep: '#c2410c',
        },
        sky: {
          DEFAULT: '#2563eb',
          deep: '#1d4ed8',
        },
        forest: '#ea580c',
        'forest-deep': '#c2410c',
        clay: '#b91c1c',
        warn: '#b45309',
        band: {
          orange: '#ffedd5',
          sky: '#bfdbfe',
          cream: '#fff7ed',
        },
      },
      fontFamily: {
        display: ['var(--font-comic)', 'Comic Neue', 'cursive'],
        play: ['var(--font-comic)', 'Comic Neue', 'cursive'],
        sans: ['var(--font-sora)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        content: '72rem',
      },
      boxShadow: {
        soft: '0 2px 0 rgba(194, 65, 12, 0.12), 0 12px 28px rgba(28, 25, 23, 0.06)',
        play: '4px 6px 0 rgba(37, 99, 235, 0.18)',
      },
    },
  },
  plugins: [],
}
