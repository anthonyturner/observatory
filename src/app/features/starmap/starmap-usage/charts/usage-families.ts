/** Series are painted by model family, so a new version keeps its family's
 *  colour. The order is fixed; the colours are tokens (--usage-*). */
export interface Family {
  readonly id: string;
  readonly label: string;
  readonly colour: string;
}

export const FAMILIES: readonly Family[] = [
  { id: 'opus', label: 'Opus', colour: 'var(--usage-opus)' },
  { id: 'sonnet', label: 'Sonnet', colour: 'var(--usage-sonnet)' },
  { id: 'haiku', label: 'Haiku', colour: 'var(--usage-haiku)' },
  { id: 'fable', label: 'Fable', colour: 'var(--usage-fable)' },
  { id: 'other', label: 'Other', colour: 'var(--usage-other)' },
];

const OTHER = FAMILIES[FAMILIES.length - 1];

export const familyColour = (id: string): string =>
  (FAMILIES.find((family) => family.id === id) ?? OTHER).colour;
