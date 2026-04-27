/**
 * germanCities.ts – City → viewBox-coordinate lookup for the geographic
 * network map. Hand-curated for German research-active cities. Lookup is
 * case-insensitive, accent-insensitive (ä→ae etc.), whitespace-trimmed.
 *
 * Unknown cities get a deterministic position in the right-edge "Sonstige"
 * stripe via djb2 hashing, so test fixtures and yet-to-be-mapped cities
 * still render — just outside the silhouette with a `?` indicator.
 *
 * ViewBox: 0 0 600 760. Germany silhouette occupies roughly x:100-510,
 * y:50-720. Sonstige stripe: x:540-580, y:120-700.
 */

export const GERMAN_CITIES: Record<string, [number, number]> = {
  // Major medical research hubs first
  'berlin':            [440, 230],
  'hamburg':           [320, 130],
  'muenchen':          [370, 620],
  'koeln':             [160, 350],
  'frankfurt am main': [230, 420],
  'frankfurt':         [230, 420],
  'stuttgart':         [270, 540],
  'duesseldorf':       [160, 320],
  'leipzig':           [390, 320],
  'dresden':           [460, 360],
  'hannover':          [280, 230],
  'bremen':            [240, 170],
  'muenster':          [200, 280],
  'heidelberg':        [250, 470],
  'nuernberg':         [350, 480],
  'karlsruhe':         [230, 510],
  'mainz':             [220, 420],
  'essen':             [160, 310],
  'bochum':            [170, 305],
  'dortmund':          [200, 305],
  'duisburg':          [150, 305],
  'wuppertal':         [180, 330],
  'bonn':              [180, 380],
  'augsburg':          [340, 580],
  'wuerzburg':         [310, 460],
  'magdeburg':         [350, 240],
  'rostock':           [380, 80],
  'kiel':              [320, 90],
  'luebeck':           [340, 110],
  'erfurt':            [320, 360],
  'saarbruecken':      [160, 510],
  'freiburg':          [220, 620],
  'aachen':            [110, 360],
  'tuebingen':         [260, 580],
  'ulm':               [300, 580],
  'mannheim':          [240, 470],
  'greifswald':        [470, 100],
  'goettingen':        [280, 290],
  'marburg':           [230, 360],
  'kassel':            [270, 320],
  'jena':              [360, 350],
  'halle':             [370, 320],
  'chemnitz':          [420, 380],
  'regensburg':        [400, 540],
  'wiesbaden':         [220, 410],
  'osnabrueck':        [220, 240],
  'bielefeld':         [240, 270],
  'krefeld':           [150, 320],
  'braunschweig':      [310, 240],
  'oldenburg':         [240, 190],
  'paderborn':         [240, 290],
  'trier':             [140, 460],
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

const SONSTIGE_X_MIN = 540;
const SONSTIGE_X_MAX = 580;
const SONSTIGE_Y_MIN = 120;
const SONSTIGE_Y_MAX = 700;

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
