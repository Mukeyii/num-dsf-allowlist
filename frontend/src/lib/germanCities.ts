/**
 * germanCities.ts – City → viewBox-coordinate lookup for the geographic
 * network map. Hand-curated for German research-active cities. Lookup is
 * case-insensitive, accent-insensitive (ä→ae etc.), whitespace-trimmed.
 *
 * Unknown cities get a deterministic position in the right-edge "Sonstige"
 * stripe via djb2 hashing, so test fixtures and yet-to-be-mapped cities
 * still render — just outside the silhouette with a `?` indicator.
 *
 * ViewBox: 0 0 700 800. The Wikimedia Karte_Deutschland.svg (native
 * 591.504 × 800.504) renders at its native size at (0, 0); the right-side
 * margin (x ∈ [600, 700]) holds the Sonstige stripe + space for legends.
 *
 * Coordinates derived by calibrating against actual Wikimedia state path
 * centroids (Berlin = (481, 256), Hamburg = (268, 154)):
 *   x = lon · 62.4 − 355
 *   y = 5720 − lat · 104
 * Sonstige stripe (unknown cities): x ∈ [620, 660], y ∈ [140, 720].
 */

export const GERMAN_CITIES: Record<string, [number, number]> = {
  // Major medical research hubs (lat/lon → projection above)
  'berlin':            [481, 257],
  'hamburg':           [269, 149],
  'muenchen':          [367, 714],
  'koeln':             [79,  422],
  'frankfurt am main': [187, 508],
  'frankfurt':         [187, 508],
  'stuttgart':         [218, 645],
  'duesseldorf':       [68,  392],
  'leipzig':           [417, 380],
  'dresden':           [502, 411],
  'hannover':          [253, 273],
  'bremen':            [195, 199],
  'muenster':          [121, 316],
  'heidelberg':        [187, 582],
  'nuernberg':         [336, 577],
  'karlsruhe':         [169, 624],
  'mainz':             [161, 521],
  'essen':             [82,  369],
  'bochum':            [96,  366],
  'dortmund':          [111, 363],
  'duisburg':          [67,  371],
  'wuppertal':         [91,  389],
  'bonn':              [88,  443],
  'augsburg':          [325, 690],
  'wuerzburg':         [264, 542],
  'magdeburg':         [371, 299],
  'rostock':           [403, 95],
  'kiel':              [277, 71],
  'luebeck':           [312, 118],
  'erfurt':            [333, 418],
  'saarbruecken':      [81,  599],
  'freiburg':          [134, 729],
  'aachen':            [25,  440],
  'tuebingen':         [210, 671],
  'ulm':               [268, 684],
  'mannheim':          [173, 571],
  'greifswald':        [480, 95],
  'goettingen':        [264, 361],
  'marburg':           [192, 436],
  'kassel':            [237, 384],
  'jena':              [368, 423],
  'halle':             [392, 366],
  'chemnitz':          [451, 433],
  'regensburg':        [400, 623],
  'wiesbaden':         [159, 511],
  'osnabrueck':        [147, 282],
  'bielefeld':         [177, 308],
  'krefeld':           [54,  380],
  'braunschweig':      [301, 283],
  'oldenburg':         [157, 193],
  'paderborn':         [192, 341],
  'trier':             [59,  546],
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ');
}

export function cityCoord(name: string | null | undefined): [number, number] | null {
  if (!name) return null;
  const key = normalize(name);
  if (!key) return null;
  return GERMAN_CITIES[key] ?? null;
}

// djb2 hash → uint32. Stable across browsers / Node, no Web Crypto needed.
function djb2(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const SONSTIGE_X_MIN = 620;
const SONSTIGE_X_MAX = 660;
const SONSTIGE_Y_MIN = 140;
const SONSTIGE_Y_MAX = 720;

export function unknownCityCoord(name: string): [number, number] {
  const h = djb2(name || '_');
  const x = SONSTIGE_X_MIN + (h % (SONSTIGE_X_MAX - SONSTIGE_X_MIN + 1));
  const y = SONSTIGE_Y_MIN + ((h >>> 8) % (SONSTIGE_Y_MAX - SONSTIGE_Y_MIN + 1));
  return [x, y];
}

export function getPinCoord(name: string | null | undefined): { coord: [number, number]; known: boolean } {
  const known = cityCoord(name);
  if (known) return { coord: known, known: true };
  return { coord: unknownCityCoord(name ?? ''), known: false };
}

/**
 * Stable bucket key for the geographic map. Used both as the cluster
 * grouping key and as the cluster `selectedId`. Centralized here so
 * cluster click-through can never drift between writer and reader.
 */
export function cityBucketKey(city: string | null | undefined, countryCode: string | null | undefined): string {
  const cityKey = (city ?? '__unknown__').toLowerCase().trim();
  const country = countryCode ?? 'DE';
  return `${cityKey}|${country}`;
}
