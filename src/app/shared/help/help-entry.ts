/** One line of a help card: a short term and what it means on that page. */
export interface HelpEntry {
  readonly term: string;
  readonly meaning: string;
}

/** A key and what it does, for the card's foot. */
export interface HelpKey {
  readonly key: string;
  readonly action: string;
}
