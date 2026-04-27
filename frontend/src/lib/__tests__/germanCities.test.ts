/**
 * germanCities.test.ts – Unit tests for city → coordinate lookup
 */
import { describe, it, expect } from 'vitest';
import { cityCoord, unknownCityCoord, getPinCoord } from '../germanCities';

describe('cityCoord', () => {
  it('returns coordinate tuple for a known city', () => {
    const c = cityCoord('Berlin');
    expect(c).not.toBeNull();
    expect(c![0]).toBeGreaterThanOrEqual(0);
    expect(c![1]).toBeGreaterThanOrEqual(0);
  });

  it('is case-insensitive', () => {
    expect(cityCoord('berlin')).toEqual(cityCoord('Berlin'));
    expect(cityCoord('BERLIN')).toEqual(cityCoord('Berlin'));
  });

  it('is accent-insensitive (umlauts)', () => {
    expect(cityCoord('München')).toEqual(cityCoord('Muenchen'));
    expect(cityCoord('Düsseldorf')).toEqual(cityCoord('Duesseldorf'));
    expect(cityCoord('Köln')).toEqual(cityCoord('Koeln'));
    expect(cityCoord('Saarbrücken')).toEqual(cityCoord('Saarbruecken'));
  });

  it('trims whitespace', () => {
    expect(cityCoord('  Berlin  ')).toEqual(cityCoord('Berlin'));
  });

  it('handles empty / null / undefined', () => {
    expect(cityCoord('')).toBeNull();
    expect(cityCoord(null)).toBeNull();
    expect(cityCoord(undefined)).toBeNull();
  });

  it('returns null for unknown city', () => {
    expect(cityCoord('Mitglieddorf')).toBeNull();
    expect(cityCoord('Nowhere')).toBeNull();
  });
});

describe('unknownCityCoord', () => {
  it('places coordinate inside the Sonstige stripe (x:620..660, y:140..720)', () => {
    const [x, y] = unknownCityCoord('Mitglieddorf');
    expect(x).toBeGreaterThanOrEqual(620);
    expect(x).toBeLessThanOrEqual(660);
    expect(y).toBeGreaterThanOrEqual(140);
    expect(y).toBeLessThanOrEqual(720);
  });

  it('is deterministic for the same input', () => {
    expect(unknownCityCoord('Mitglieddorf')).toEqual(unknownCityCoord('Mitglieddorf'));
  });

  it('produces different positions for different inputs', () => {
    const a = unknownCityCoord('Mitglieddorf');
    const b = unknownCityCoord('Standortburg');
    expect(a).not.toEqual(b);
  });
});

describe('getPinCoord', () => {
  it('returns known=true for a known city', () => {
    const r = getPinCoord('Berlin');
    expect(r.known).toBe(true);
  });

  it('returns known=false for unknown city', () => {
    const r = getPinCoord('Mitglieddorf');
    expect(r.known).toBe(false);
    expect(r.coord[0]).toBeGreaterThanOrEqual(620);
  });

  it('returns known=false for null', () => {
    const r = getPinCoord(null);
    expect(r.known).toBe(false);
  });
});
