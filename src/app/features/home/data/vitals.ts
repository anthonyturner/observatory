/** At or above this share of a limit, a reading turns amber. */
export const HOT_PERCENT = 80;

/** One vital. A null `value` means unknown, and `note` then says why. */
export interface VitalReading {
  readonly id: string;
  readonly label: string;
  readonly value: string | null;
  readonly unit?: string;
  /** How old the reading is, as a short age ("4m"). */
  readonly age?: string;
  readonly note?: string;
  /** Where readings come from, for an unknown one that could have them. */
  readonly how?: string;
  readonly series?: readonly number[];
  /** Fixes the sparkline's scale, for readings with a ceiling such as a percent. */
  readonly max?: number;
  readonly isHot?: boolean;
}

/** The weekly limit. A null `percentUsed` means unknown. */
export interface WeeklyUsage {
  readonly percentUsed: number | null;
  readonly note: string;
}

/** One item from the top of the blocked-first queue. */
export interface Directive {
  readonly title: string;
  readonly href: string;
  readonly detail: string;
  readonly color: string;
}

export interface DirectiveList {
  readonly items: readonly Directive[];
  readonly note: string;
}

export interface DocLink {
  readonly label: string;
  readonly href: string;
}

export interface DocTabs {
  /** The project the star-map tabs open, first in the queue. */
  readonly project?: string;
  readonly links: readonly DocLink[];
}

/** Everything Home's left column shows. */
export interface VitalsColumn {
  readonly vitals: readonly VitalReading[];
  readonly weekly: WeeklyUsage;
  readonly directives: DirectiveList;
  readonly docs: DocTabs;
}
