/**
 * dsfResources.test.ts — validates the static DSF Resources catalog: every
 * category has a heading key and links, and every link has a literal title, an
 * https URL, and a descKey that actually resolves in the en translation table
 * (the descKey type is a compile-time guarantee; this asserts it at runtime too).
 */
import { describe, it, expect } from 'vitest';
import { DSF_RESOURCES } from '../dsfResources';
import { en } from '../../i18n/en';

describe('DSF_RESOURCES', () => {
  it('has at least one category, each with a non-empty links list', () => {
    expect(DSF_RESOURCES.length).toBeGreaterThan(0);
    for (const cat of DSF_RESOURCES) {
      expect(cat.links.length).toBeGreaterThan(0);
    }
  });

  it('resolves every category heading key in the en table', () => {
    for (const cat of DSF_RESOURCES) {
      expect(en[cat.headingKey]).toBeTruthy();
    }
  });

  it('gives every link a title, an https URL, and a resolvable descKey', () => {
    const links = DSF_RESOURCES.flatMap((c) => c.links);
    for (const link of links) {
      expect(link.title.trim().length).toBeGreaterThan(0);
      expect(link.url).toMatch(/^https:\/\//);
      expect(en[link.descKey]).toBeTruthy();
    }
  });

  it('points at no duplicate URLs', () => {
    const urls = DSF_RESOURCES.flatMap((c) => c.links).map((l) => l.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
