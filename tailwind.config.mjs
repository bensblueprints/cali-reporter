/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Source Serif 4"', '"Source Serif Pro"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      colors: {
        ink: '#111111',
        paper: '#fbfaf6',
        accent: '#b03020',
        muted: '#6b6b6b',
        rule: '#dcdcd4',
      },
      maxWidth: {
        prose: '68ch',
      },
    },
  },
  plugins: [],
};
