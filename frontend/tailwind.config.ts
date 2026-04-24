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
        primary: '#b01e66',
        'primary-container': '#8a1750',
        secondary: '#006b5a',
        tertiary: '#805200',
        error: '#ba1a1a',
        brand: {
          50:  '#fde3ef',
          100: '#fbc9de',
          400: '#e06399',
          600: '#b01e66',
          700: '#8a1750',
          900: '#4a0b28',
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
        card: '0 2px 8px rgba(176,30,102,0.07)',
        'card-hover': '0 4px 16px rgba(176,30,102,0.13)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
