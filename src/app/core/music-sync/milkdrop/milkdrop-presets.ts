/** Presets from Butterchurn's pack that suit trance and techno: tunnels,
 *  spirals, nebulae and neon, rather than the pack's slower paintings. */
export const CURATED_PRESETS: readonly string[] = [
  'Flexi, martin + geiss - dedicated to the sherwin maxawow',
  'Flexi - predator-prey-spirals',
  'Flexi + Martin - astral projection',
  'martin - angel flight',
  'Geiss - Spiral Artifact',
  'Rovastar + Loadus + Geiss - FractalDrop (Triple Mix)',
  'Unchained & Rovastar - Wormhole Pillars (Hall of Shadows mix)',
  "TonyMilkdrop - Magellan's Nebula [Flexi - you enter first + multiverse]",
  'Zylot - True Visionary (Final Mix)',
  'Eo.S. + Zylot - skylight (Stained Glass Majesty mix)',
  'flexi + fishbrain - neon mindblob grafitti',
  'martin - disco mix 4',
  'Krash + Illusion - Spiral Movement',
  'Fumbling_Foo & Flexi, Martin, Orb, Unchained - Star Nova v7b',
  'Flexi - infused with the spiral',
  'martin - glass corridor',
];

/** The preset `variant`, from 0 to 1, picks: one of the curated presets the pack
 *  has, or any of its presets if it has none of them. */
export function presetFor(variant: number, available: readonly string[]): string | null {
  const curated = CURATED_PRESETS.filter((name) => available.includes(name));
  const from = curated.length > 0 ? curated : available;
  if (from.length === 0) return null;
  const index = Math.min(from.length - 1, Math.floor(Math.max(0, variant) * from.length));
  return from[index];
}
