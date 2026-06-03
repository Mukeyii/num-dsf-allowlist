/**
 * theme.store.ts – Dark/light mode persistence via localStorage and CSS class
 * Dependencies: zustand
 */
import { create } from 'zustand';

interface ThemeState {
  dark: boolean;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  dark: localStorage.getItem('dsf-theme') === 'dark',
  toggleTheme: () =>
    set((s) => {
      const next = !s.dark;
      localStorage.setItem('dsf-theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', next);
      return { dark: next };
    }),
}));

// Initialize on load
if (localStorage.getItem('dsf-theme') === 'dark') {
  document.documentElement.classList.add('dark');
}
