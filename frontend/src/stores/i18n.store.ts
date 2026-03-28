/**
 * i18n.store.ts – Language toggle store (DE/EN)
 * Dependencies: zustand
 */
import { create } from 'zustand';

type Lang = 'de' | 'en';

const translations = {
  en: {
    signIn: 'Sign in',
    signOut: 'Sign out',
    email: 'Email address',
    sendCode: 'Send code →',
    sendingCode: 'Sending code…',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    approvalReview: 'Approval Review',
    instances: 'Instances',
    newInstance: '+ New instance',
    noInstanceSelected: 'No instance selected',
    sendForApproval: 'Send for Approval',
    downloadAllowList: 'Download Allow List',
    searchEntities: 'Search entities…',
    organization: 'Organization',
    contacts: 'Contacts',
    endpoints: 'Endpoints',
    certificates: 'Certificates',
    memberships: 'Memberships',
    approval: 'Approval Summary',
    noData: 'No data yet.',
    loading: 'Loading…',
    edit: 'Edit',
    delete: 'Delete',
    add: '+ Add',
    submit: 'Submit',
    cancel: 'Cancel',
    approve: 'Approve',
    reject: 'Reject',
    auditLog: 'Audit Log',
    gettingStarted: 'Getting Started',
    pageNotFound: 'Page Not Found',
    backToDashboard: 'Back to Dashboard',
  },
  de: {
    signIn: 'Anmelden',
    signOut: 'Abmelden',
    email: 'E-Mail-Adresse',
    sendCode: 'Code senden →',
    sendingCode: 'Code wird gesendet…',
    darkMode: 'Dunkelmodus',
    lightMode: 'Hellmodus',
    approvalReview: 'Genehmigungen prüfen',
    instances: 'Instanzen',
    newInstance: '+ Neue Instanz',
    noInstanceSelected: 'Keine Instanz ausgewählt',
    sendForApproval: 'Zur Genehmigung senden',
    downloadAllowList: 'Allow-Liste herunterladen',
    searchEntities: 'Entitäten suchen…',
    organization: 'Organisation',
    contacts: 'Kontakte',
    endpoints: 'Endpunkte',
    certificates: 'Zertifikate',
    memberships: 'Mitgliedschaften',
    approval: 'Genehmigungsübersicht',
    noData: 'Noch keine Daten.',
    loading: 'Laden…',
    edit: 'Bearbeiten',
    delete: 'Löschen',
    add: '+ Hinzufügen',
    submit: 'Einreichen',
    cancel: 'Abbrechen',
    approve: 'Genehmigen',
    reject: 'Ablehnen',
    auditLog: 'Audit-Protokoll',
    gettingStarted: 'Erste Schritte',
    pageNotFound: 'Seite nicht gefunden',
    backToDashboard: 'Zurück zum Dashboard',
  },
} as const;

type TranslationKey = keyof typeof translations.en;

interface I18nState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

export const useI18n = create<I18nState>((set, get) => ({
  lang: (localStorage.getItem('dsf-lang') as Lang) || 'en',
  setLang: (lang) => {
    localStorage.setItem('dsf-lang', lang);
    set({ lang });
  },
  t: (key) => {
    const lang = get().lang;
    return translations[lang][key] || translations.en[key] || key;
  },
}));
