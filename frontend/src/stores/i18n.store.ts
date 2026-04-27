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
    networkMap: 'Network Map',
    gettingStarted: 'Getting Started',
    pageNotFound: 'Page Not Found',
    backToDashboard: 'Back to Dashboard',
    approvalStatus: 'Approval Status',
    overview: 'Overview',
    recentActivity: 'Recent Activity',
    noRequest: 'No request',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    status: 'Status',
    approvalHistory: 'Approval History',
    noApprovalRequests: 'No approval requests yet.',
    certExpiresIn: 'Certificate expires in',
    nextExpiry: 'Next expiry',
    serverError: 'Server error. Please try again later.',
    rateLimited: 'Too many requests. Please wait a moment.',
    networkError: 'Network error. Check your connection.',
    sessionExpiring: 'Your session will expire in 2 minutes due to inactivity.',
    sessionExpired: 'Session expired due to inactivity.',
    // Dashboard
    dashboard: 'Dashboard',

    // Map — page-level
    mapAdminViewSubtitle: 'Admin view · full details for every approved node',
    mapMemberViewSubtitle: 'Active P2P nodes across the allow list',
    mapRoleAdmin: 'Admin',
    mapRoleMember: 'Member',
    mapLoadingNetwork: 'Loading network…',
    mapLoadFailed: 'Failed to load network map.',

    // Map — graph
    mapCentralTitle: 'DSF ALLOW LIST',
    mapCentralSubtitleOne: 'active organization',
    mapCentralSubtitleMany: 'active organizations',
    mapEmptyState: 'No approved organizations in the allow list yet.',
    mapSonstigeLabel: 'Other',
    mapClusterCity: '{n} sites in {city}',

    // Map — filters
    mapFilterSearchPlaceholder: 'Filter by name or identifier…',
    mapFilterAll: 'all',
    mapFilterActive: 'active',
    mapFilterInactive: 'inactive',
    mapFilterShowingOf: 'Showing {visible} of {total}',
    mapFilterShowingOfCities: 'Showing {visible} of {total} sites in {cities} cities',
    mapShowAllEdges: 'Show all connections',

    // Map — cert status chip labels
    mapStatusValid: 'Valid',
    mapStatusExpiring: 'Expiring',
    mapStatusExpired: 'Expired',
    mapStatusNone: 'No cert',

    // Map — details panel
    mapDetailsActive: 'Active',
    mapDetailsInactive: 'Inactive',
    mapDetailsCertLabel: 'Certificate',
    mapDetailsCertValid: 'Valid',
    mapDetailsCertExpiring: 'Expiring soon',
    mapDetailsCertExpired: 'Expired',
    mapDetailsCertNone: 'No certificate',
    mapDetailsExpiredText: 'This certificate has expired. Renew it to keep this node active in the allow list.',
    mapDetailsExpiringText: 'This certificate expires soon. Plan a renewal to avoid downtime.',
    mapDetailsDayRemainingOne: '1 day remaining',
    mapDetailsDaysRemainingMany: '{n} days remaining',
    mapDetailsExpiredAgoOne: 'Expired 1 day ago',
    mapDetailsExpiredAgoMany: 'Expired {n} days ago',
    mapDetailsEndpoints: 'Endpoints',
    mapDetailsContacts: 'Contacts',
    mapDetailsMemberships: 'Memberships',
    mapDetailsLocation: 'Location',
    mapDetailsCity: 'City',
    mapDetailsCountry: 'Country',
    mapDetailsEmail: 'Email',
    mapDetailsNoEndpoints: 'No endpoints',
    mapDetailsNoContacts: 'No contacts',
    mapDetailsNoMemberships: 'No memberships',
    mapCloseDetails: 'Close details',

    // Map — expiry banner
    mapBannerExpiredOne: '1 certificate has expired',
    mapBannerExpiredMany: '{n} certificates have expired',
    mapBannerExpiringOne: '1 expires within 30 days',
    mapBannerExpiringMany: '{n} expire within 30 days',
    mapBannerDismiss: 'Dismiss warning',

    // Map — remaining keys
    mapClusterMatchedHint: '{matched} matching · {hidden} hidden by filter',
    mapInternationalCount: 'International ({n}): {countries}',
    mapCityUnknown: 'Position unknown — placed in "Other" zone',
    footerDeveloper: 'Kemal Yildirim',
    footerAffiliation: 'Institute of Medical Informatics, University of Münster',
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
    networkMap: 'Netzwerkkarte',
    gettingStarted: 'Erste Schritte',
    pageNotFound: 'Seite nicht gefunden',
    backToDashboard: 'Zurück zum Dashboard',
    approvalStatus: 'Genehmigungsstatus',
    overview: 'Übersicht',
    recentActivity: 'Letzte Aktivitäten',
    noRequest: 'Kein Antrag',
    pending: 'Ausstehend',
    approved: 'Genehmigt',
    rejected: 'Abgelehnt',
    status: 'Status',
    approvalHistory: 'Genehmigungsverlauf',
    noApprovalRequests: 'Noch keine Genehmigungsanträge.',
    certExpiresIn: 'Zertifikat läuft ab in',
    nextExpiry: 'Nächster Ablauf',
    serverError: 'Serverfehler. Bitte versuche es später erneut.',
    rateLimited: 'Zu viele Anfragen. Bitte warte einen Moment.',
    networkError: 'Netzwerkfehler. Prüfe deine Verbindung.',
    sessionExpiring: 'Deine Sitzung läuft in 2 Minuten ab (Inaktivität).',
    sessionExpired: 'Sitzung wegen Inaktivität abgelaufen.',
    // Dashboard
    dashboard: 'Übersicht',

    // Map — page-level
    mapAdminViewSubtitle: 'Admin-Ansicht · vollständige Details für jeden freigegebenen Knoten',
    mapMemberViewSubtitle: 'Aktive P2P-Knoten in der Allow-Liste',
    mapRoleAdmin: 'Admin',
    mapRoleMember: 'Mitglied',
    mapLoadingNetwork: 'Netzwerk wird geladen…',
    mapLoadFailed: 'Netzwerkkarte konnte nicht geladen werden.',

    // Map — graph
    mapCentralTitle: 'DSF ALLOW LIST',
    mapCentralSubtitleOne: 'aktive Organisation',
    mapCentralSubtitleMany: 'aktive Organisationen',
    mapEmptyState: 'Noch keine freigegebenen Organisationen in der Allow-Liste.',
    mapSonstigeLabel: 'Sonstige',
    mapClusterCity: '{n} Standorte in {city}',

    // Map — filters
    mapFilterSearchPlaceholder: 'Filter nach Name oder Kennung…',
    mapFilterAll: 'alle',
    mapFilterActive: 'aktiv',
    mapFilterInactive: 'inaktiv',
    mapFilterShowingOf: 'Zeige {visible} von {total}',
    mapFilterShowingOfCities: 'Zeige {visible} von {total} Standorten in {cities} Städten',
    mapShowAllEdges: 'Alle Verbindungen anzeigen',

    // Map — cert status chip labels
    mapStatusValid: 'Gültig',
    mapStatusExpiring: 'Läuft ab',
    mapStatusExpired: 'Abgelaufen',
    mapStatusNone: 'Kein Zertifikat',

    // Map — details panel
    mapDetailsActive: 'Aktiv',
    mapDetailsInactive: 'Inaktiv',
    mapDetailsCertLabel: 'Zertifikat',
    mapDetailsCertValid: 'Gültig',
    mapDetailsCertExpiring: 'Läuft bald ab',
    mapDetailsCertExpired: 'Abgelaufen',
    mapDetailsCertNone: 'Kein Zertifikat',
    mapDetailsExpiredText: 'Dieses Zertifikat ist abgelaufen. Erneuere es, damit dieser Knoten aktiv bleibt.',
    mapDetailsExpiringText: 'Dieses Zertifikat läuft bald ab. Plane eine Erneuerung, um Ausfälle zu vermeiden.',
    mapDetailsDayRemainingOne: '1 Tag verbleibend',
    mapDetailsDaysRemainingMany: '{n} Tage verbleibend',
    mapDetailsExpiredAgoOne: 'Vor 1 Tag abgelaufen',
    mapDetailsExpiredAgoMany: 'Vor {n} Tagen abgelaufen',
    mapDetailsEndpoints: 'Endpunkte',
    mapDetailsContacts: 'Kontakte',
    mapDetailsMemberships: 'Mitgliedschaften',
    mapDetailsLocation: 'Standort',
    mapDetailsCity: 'Stadt',
    mapDetailsCountry: 'Land',
    mapDetailsEmail: 'E-Mail',
    mapDetailsNoEndpoints: 'Keine Endpunkte',
    mapDetailsNoContacts: 'Keine Kontakte',
    mapDetailsNoMemberships: 'Keine Mitgliedschaften',
    mapCloseDetails: 'Details schließen',

    // Map — expiry banner
    mapBannerExpiredOne: '1 Zertifikat ist abgelaufen',
    mapBannerExpiredMany: '{n} Zertifikate sind abgelaufen',
    mapBannerExpiringOne: '1 läuft innerhalb von 30 Tagen ab',
    mapBannerExpiringMany: '{n} laufen innerhalb von 30 Tagen ab',
    mapBannerDismiss: 'Warnung schließen',

    // Map — remaining keys
    mapClusterMatchedHint: '{matched} treffend · {hidden} durch Filter ausgeblendet',
    mapInternationalCount: 'International ({n}): {countries}',
    mapCityUnknown: 'Position unbekannt — im "Sonstige"-Bereich platziert',
    footerDeveloper: 'Kemal Yildirim',
    footerAffiliation: 'Institut für Medizinische Informatik, Universität Münster',
  },
} as const;

type TranslationKey = keyof typeof translations.en;

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
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  },
}));
