/**
 * i18n.store.test.ts — pure tests for the translation store: language switch,
 * {param} substitution, and the English fallback when a value is absent.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useI18n } from '../i18n.store';

describe('useI18n', () => {
  beforeEach(() => { useI18n.getState().setLang('en'); });

  it('returns the English string by default', () => {
    expect(useI18n.getState().t('signIn')).toBe('Sign in');
  });

  it('returns the German string after switching language', () => {
    useI18n.getState().setLang('de');
    expect(useI18n.getState().t('signIn')).toBe('Anmelden');
  });

  it('substitutes a named parameter', () => {
    expect(useI18n.getState().t('relAgoMinutes', { n: 5 })).toBe('5m ago');
  });

  it('substitutes parameters in the German value too', () => {
    useI18n.getState().setLang('de');
    expect(useI18n.getState().t('relAgoMinutes', { n: 5 })).toBe('vor 5m');
  });

  it('persists the chosen language to localStorage', () => {
    useI18n.getState().setLang('de');
    expect(localStorage.getItem('dsf-lang')).toBe('de');
  });
});
