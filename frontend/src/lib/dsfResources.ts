/**
 * dsfResources.ts — static catalog for the DSF Resources page.
 * Titles are proper nouns (kept literal); descriptions are i18n keys so a
 * typo in a key is a compile error.
 * Dependencies: ../i18n/en (TranslationKey)
 */
import type { TranslationKey } from '../i18n/en';

export interface DsfLink {
  title: string;
  url: string;
  descKey: TranslationKey;
}

export interface DsfResourceCategory {
  headingKey: TranslationKey;
  links: DsfLink[];
}

export const DSF_RESOURCES: DsfResourceCategory[] = [
  {
    headingKey: 'dsfResourcesCatGettingStarted',
    links: [
      {
        title: 'DSF Use Cases & Overview',
        url: 'https://dsf.dev/explore/use-cases/',
        descKey: 'dsfResourcesDescUseCases',
      },
    ],
  },
  {
    headingKey: 'dsfResourcesCatOperations',
    links: [
      {
        title: 'Operations Docs (v2.1.0)',
        url: 'https://dsf.dev/operations/get-started.html',
        descKey: 'dsfResourcesDescOperations',
      },
      {
        title: 'Security Policy & Advisories',
        url: 'https://dsf.dev/security/',
        descKey: 'dsfResourcesDescSecurity',
      },
    ],
  },
  {
    headingKey: 'dsfResourcesCatDevelopment',
    links: [
      {
        title: 'DSF Linter',
        url: 'https://dsf.dev/process-development/linter-tool/linter-tool.html',
        descKey: 'dsfResourcesDescLinter',
      },
      {
        title: 'Process API v1',
        url: 'https://dsf.dev/process-development/api-v1/',
        descKey: 'dsfResourcesDescApiV1',
      },
      {
        title: 'Process API v2',
        url: 'https://dsf.dev/process-development/api-v2/',
        descKey: 'dsfResourcesDescApiV2',
      },
      {
        title: 'FHIR Implementation Guide',
        url: 'https://dsf.dev/dsf-development/v2/fhir-ig.html',
        descKey: 'dsfResourcesDescFhirIg',
      },
    ],
  },
  {
    headingKey: 'dsfResourcesCatEcosystem',
    links: [
      {
        title: 'DSF Process Hub',
        url: 'https://hub.dsf.dev',
        descKey: 'dsfResourcesDescHub',
      },
      {
        title: 'Source Code (GitHub)',
        url: 'https://github.com/datasharingframework/dsf',
        descKey: 'dsfResourcesDescGithub',
      },
      {
        title: 'Community & Contact',
        url: 'https://dsf.dev/community/',
        descKey: 'dsfResourcesDescCommunity',
      },
    ],
  },
];
