/** One tile: the number someone came for, with a line of context. */
export interface TileView {
  readonly label: string;
  readonly value: string;
  readonly sub: string;
  /** Amber: the limit is close, or the pace runs out before the reset. */
  readonly isWarn: boolean;
  /** How full a meter under the context is, 0 to 100; null for none. */
  readonly meter: number | null;
}

export const tileOf = (label: string, value: string, sub: string): TileView => ({
  label,
  value,
  sub,
  isWarn: false,
  meter: null,
});
