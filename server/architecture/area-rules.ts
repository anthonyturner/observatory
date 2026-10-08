/** An area and the folder, relative to the project root, that its files live under. */
export interface AreaRule {
  readonly id: string;
  readonly label: string;
  readonly root: string;
}

/**
 * The areas of the project being mapped. The first rule whose root holds a file
 * wins, so a narrower folder is listed before the wider one that contains it.
 */
export const AREA_RULES: readonly AreaRule[] = [
  { id: 'jarvis', label: 'Jarvis', root: 'src/app/services/jarvis' },
  { id: 'services', label: 'Services', root: 'src/app/services' },
  { id: 'hud', label: 'HUD widgets', root: 'src/app/components/game-stats-hud' },
  { id: 'desktop', label: 'Desktop', root: 'src/app/components/desktop' },
  { id: 'components', label: 'Other components', root: 'src/app/components' },
  { id: 'features', label: 'Features', root: 'src/app/features' },
  { id: 'core', label: 'Core', root: 'src/app/core' },
  { id: 'app', label: 'App shell', root: 'src/app' },
];

/** Where a file sits: its area, and the folder below that area's root. */
export interface Place {
  readonly area: string;
  readonly group: string;
}

const holds = (root: string, file: string): boolean => file.startsWith(`${root}/`);

/** The place of `file`, a path relative to the project root; null when no rule holds it. */
export function placeOf(file: string, rules: readonly AreaRule[]): Place | null {
  const rule = rules.find(({ root }) => holds(root, file));
  if (!rule) return null;
  const below = file.slice(rule.root.length + 1).split('/');
  return { area: rule.id, group: below.length > 1 ? (below[0] ?? '') : '' };
}
