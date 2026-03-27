import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#f7f9ff',
        surface: '#f7f9ff',
        'surface-container-low': '#f1f3f9',
        'surface-container-lowest': '#ffffff',
        'on-surface': '#181c20',
        'on-surface-variant': '#464555',
        'outline-variant': '#c7c4d8',
        primary: '#4d41df',
        'primary-container': '#675df9',
        secondary: '#006b5a',
        tertiary: '#805200',
        error: '#ba1a1a',
        brand: {
          50:  '#ede9ff',
          100: '#d4ccff',
          400: '#8b82ff',
          600: '#6c63ff',
          700: '#5a52d5',
          900: '#2d2880',
        },
        canvas: '#f0f2f8',
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
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
