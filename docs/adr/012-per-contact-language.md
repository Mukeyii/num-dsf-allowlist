# ADR-012 — Per-contact notification language

- Status: Accepted
- Date: 2026-06-02
- Deciders: IMI Münster team

## Context

After an approval, the portal emails the site's contacts. Contacts at a site may
prefer different languages (German or English), and a wrong-language mail about a
federation-critical event is poor service. The language preference belongs to the
individual contact, not the organization or the sender.

## Decision

Migration `018_contacts_language.sql` adds a `language CHAR(2) NOT NULL DEFAULT
'en'` column to `contacts`. Notification code reads this per recipient: the
approval-reminder/notification path selects `language` alongside email and name,
narrows it to `'de' | 'en'` (`c.language === 'de' ? 'de' : 'en'`), and passes it
into the mail template
(`backend/src/services/approval-reminder.service.ts`,
`notification.service.ts`). The template
(`mail-templates/approved-bundle-mail.ts`) picks the string table
`STR[ctx.language] ?? STR.en` and sets `<html lang="…">` accordingly, falling
back to English for any unknown locale. New and existing contacts default to
`en`.

## Consequences

Positive:

- Each contact receives notifications in their own locale, decided per recipient
  rather than per organization.
- The English fallback (column default plus `?? STR.en` in the renderer) means a
  missing or stray value never breaks mail rendering.

Negative:

- Only two locales (DE/EN) are supported; adding more requires both schema
  values and new template string tables.
- The preference must be captured and maintained per contact; absent input,
  recipients silently get English.
