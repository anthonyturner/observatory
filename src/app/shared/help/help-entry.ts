/** One line of a help card: a short term and what it means on that page. */
export interface HelpEntry {
  readonly term: string;
  readonly meaning: string;
  /** The heading it sits under; entries in a row with the same one share it. */
  readonly section?: string;
}

/** A run of entries under one heading, or none. */
export interface HelpSection {
  readonly heading: string | null;
  readonly entries: readonly HelpEntry[];
}

/** Groups consecutive entries by their section, keeping the page's order. */
export function helpSections(entries: readonly HelpEntry[]): HelpSection[] {
  const sections: { heading: string | null; entries: HelpEntry[] }[] = [];
  for (const entry of entries) {
    const heading = entry.section ?? null;
    const last = sections.at(-1);
    if (last && last.heading === heading) last.entries.push(entry);
    else sections.push({ heading, entries: [entry] });
  }
  return sections;
}

/** A key and what it does, for the card's foot. */
export interface HelpKey {
  readonly key: string;
  readonly action: string;
}
