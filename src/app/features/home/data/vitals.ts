import { InjectionToken, Signal, signal } from '@angular/core';

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

const SAMPLE_VITALS_COLUMN: VitalsColumn = {
  vitals: [
    {
      id: 'tokens',
      label: 'Tokens today',
      value: '1.2M',
      age: '4m',
      note: 'avg 940k /day',
      series: [620, 880, 1040, 760, 990, 1310, 1200],
    },
    {
      id: 'issues',
      label: 'Open issues',
      value: '16',
      age: '4m',
      note: '▲ 3 in 7d',
      series: [11, 12, 12, 14, 13, 15, 16],
    },
    {
      id: 'five',
      label: '5-hour window',
      value: '84',
      unit: '%',
      age: '1m',
      note: 'resets 14:00',
      series: [12, 30, 41, 55, 63, 77, 84],
      max: 100,
      isHot: true,
    },
  ],
  weekly: { percentUsed: 62, note: 'resets Mon 09:00 · on pace for 88%' },
  directives: {
    items: [
      {
        title: 'Split the pages into small files',
        href: 'https://github.com/anthonyturner/pr-starmap/pull/81',
        detail: 'pr-starmap #81 · cannot merge',
        color: 'var(--count-conflicted)',
      },
      {
        title: 'Read tier-3 runs as a transcript',
        href: 'https://github.com/anthonyturner/pr-starmap/pull/79',
        detail: 'pr-starmap #79 · checks failing',
        color: 'var(--count-failing)',
      },
      {
        title: 'Install the playbook from a template',
        href: 'https://github.com/anthonyturner/agent-playbook/pull/12',
        detail: 'agent-playbook #12 · mergeability unknown',
        color: 'var(--count-unknown)',
      },
    ],
    note: 'Blocked first · on GitHub',
  },
  docs: {
    project: 'pr-starmap',
    links: [
      { label: 'Star map', href: '/p/anthonyturner/pr-starmap' },
      { label: 'Orrery', href: '/orrery' },
      { label: 'Issues', href: '/p/anthonyturner/pr-starmap#issues' },
      { label: 'Logs', href: '/p/anthonyturner/pr-starmap#logs' },
      { label: 'Usage', href: '/p/anthonyturner/pr-starmap#usage' },
    ],
  },
};

/** Where Home's left column reads from: sample data until the live source lands. */
export const VITALS_COLUMN = new InjectionToken<Signal<VitalsColumn>>('VITALS_COLUMN', {
  providedIn: 'root',
  factory: () => signal(SAMPLE_VITALS_COLUMN).asReadonly(),
});
