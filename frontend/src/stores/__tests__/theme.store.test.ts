/**
 * theme.store.test.ts — pure test for the theme store: toggleTheme flips the
 * mode, persists it to localStorage, and reflects it on the document element.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../theme.store';

describe('useThemeStore', () => {
  beforeEach(() => {
    localStorage.removeItem('dsf-theme');
    document.documentElement.classList.remove('dark');
  });

  it('toggles from light to dark and persists', () => {
    const wasDark = useThemeStore.getState().dark;
    useThemeStore.getState().toggleTheme();
    const s = useThemeStore.getState();
    expect(s.dark).toBe(!wasDark);
    expect(localStorage.getItem('dsf-theme')).toBe(s.dark ? 'dark' : 'light');
    expect(document.documentElement.classList.contains('dark')).toBe(s.dark);
  });

  it('toggles back on a second call', () => {
    const start = useThemeStore.getState().dark;
    useThemeStore.getState().toggleTheme();
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().dark).toBe(start);
  });
});
