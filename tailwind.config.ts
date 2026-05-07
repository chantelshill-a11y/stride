import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        forest: '#2C4A35',
        'forest-dark': '#1F3526',
        'forest-soft': '#3F5E48',
        cream: '#F7F5F1',
        'cream-warm': '#EFEBE2',
        charcoal: '#2A2A2A',
        'charcoal-soft': '#4A4A4A',
        'charcoal-mute': '#7A7A7A',
        rule: '#D9D2C5',
        rag: {
          green: '#2C4A35',
          amber: '#A6792A',
          red: '#8C2A2A',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Jost', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        none: '0',
        sm: '0',
        DEFAULT: '0',
        md: '0',
        lg: '0',
      },
      letterSpacing: {
        wide: '0.04em',
        wider: '0.08em',
        widest: '0.16em',
      },
    },
  },
  plugins: [],
};

export default config;
