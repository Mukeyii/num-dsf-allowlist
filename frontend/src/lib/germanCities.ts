/**
 * germanCities.ts – City → viewBox-coordinate lookup for the geographic
 * network map. Hand-curated for German research-active cities. Lookup is
 * case-insensitive, accent-insensitive (ä→ae etc.), whitespace-trimmed.
 *
 * Unknown cities get a deterministic position in the right-edge "Sonstige"
 * stripe via djb2 hashing, so test fixtures and yet-to-be-mapped cities
 * still render — just outside the silhouette with a `?` indicator.
 *
 * ViewBox: 0 0 591.504 800.504 (matches the Wikimedia Karte_Deutschland.svg
 * served from /germany.svg). Coordinates derived by linear projection of
 * lat/lon onto Wikimedia native pixels:
 *   x = 110 + (lon − 5.87) · 48
 *   y = 15  + (55.06 − lat) · 74.5
 * Sonstige stripe (unknown cities): x ∈ [555, 585], y ∈ [130, 720].
 */

export const GERMAN_CITIES: Record<string, [number, number]> = {
  // Major medical research hubs (lat/lon → projection above)
  'berlin':            [471, 206],
  'hamburg':           [308, 128],
  'muenchen':          [384, 531],
  'koeln':             [162, 322],
  'frankfurt am main': [245, 384],
  'frankfurt':         [245, 384],
  'stuttgart':         [269, 483],
  'duesseldorf':       [154, 300],
  'leipzig':           [422, 292],
  'dresden':           [488, 314],
  'hannover':          [296, 215],
  'bremen':            [251, 163],
  'muenster':          [194, 246],
  'heidelberg':        [245, 437],
  'nuernberg':         [360, 433],
  'karlsruhe':         [231, 467],
  'mainz':             [225, 393],
  'essen':             [164, 284],
  'bochum':            [175, 282],
  'dortmund':          [187, 280],
  'duisburg':          [153, 285],
  'wuppertal':         [171, 298],
  'bonn':              [169, 337],
  'augsburg':          [351, 513],
  'wuerzburg':         [305, 408],
  'magdeburg':         [387, 233],
  'rostock':           [411, 87],
  'kiel':              [315, 70],
  'luebeck':           [341, 104],
  'erfurt':            [358, 319],
  'saarbruecken':      [164, 449],
  'freiburg':          [205, 542],
  'aachen':            [120, 334],
  'tuebingen':         [263, 502],
  'ulm':               [308, 511],
  'mannheim':          [234, 430],
  'greifswald':        [471, 87],
  'goettingen':        [305, 278],
  'marburg':           [249, 332],
  'kassel':            [284, 294],
  'jena':              [385, 323],
  'halle':             [403, 282],
  'chemnitz':          [448, 330],
  'regensburg':        [409, 466],
  'wiesbaden':         [224, 386],
  'osnabrueck':        [215, 222],
  'bielefeld':         [238, 241],
  'krefeld':           [143, 292],
  'braunschweig':      [333, 223],
  'oldenburg':         [222, 158],
  'paderborn':         [249, 264],
  'trier':             [147, 411],
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

const SONSTIGE_X_MIN = 558;
const SONSTIGE_X_MAX = 582;
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
