/**
 * i18n.store.ts – Language toggle store (DE/EN)
 *
 * Translation tables live in ../i18n/en.ts and ../i18n/de.ts. en.ts is the
 * source of truth for the key set; de.ts is typed as
 * Record<TranslationKey, string> so any new key in en triggers a
 * compile-time error in de until the German translation is added.
 *
 * Dependencies: zustand, ../i18n/en, ../i18n/de
 */
import { create } from 'zustand';
import { en, type TranslationKey } from '../i18n/en';
import { de } from '../i18n/de';

type Lang = 'de' | 'en';

const translations = { en, de };

interface I18nState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

export const useI18n = create<I18nState>((set, get) => ({
  lang: (localStorage.getItem('dsf-lang') as Lang) || 'en',
  setLang: (lang) => {
    localStorage.setItem('dsf-lang', lang);
    set({ lang });
  },
  t: (key, params) => {
    const lang = get().lang;
    let str: string = translations[lang][key] || translations.en[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.split(`{${k}}`).join(String(v));
      }
    }
    return str;
  },
}));
