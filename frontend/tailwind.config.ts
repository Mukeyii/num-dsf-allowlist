import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#ede9ff',
          100: '#d4ccff',
          400: '#8b82ff',
          600: '#6c63ff',
          700: '#5a52d5',
          900: '#2d2880',
        },
        surface: '#f0f2f8',
        card:    '#ffffff',
        border:  '#e8eaf0',
        muted:   '#9b9fad',
        ink:     '#1a1a2e',
      },
      borderRadius: {
        card:   '16px',
        button: '10px',
        input:  '10px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(108,99,255,0.07)',
        'card-hover': '0 4px 16px rgba(108,99,255,0.13)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
