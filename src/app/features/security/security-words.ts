import {
  AlertKind,
  AlertSeverity,
  AlertSource,
  SEVERITIES,
  SecurityReport,
  openAlertCount,
} from '../../core/security/security-report';
import { SecurityState } from '../../core/security/security-feed';
import { plural } from '../../shared/text/plural';
import { agoWords } from '../actions/actions-words';
import { PageMessage } from '../releases/releases-page/releases-words';

/* How the Security screen names kinds, grades and states. */

export const KIND_WORDS: Readonly<Record<AlertKind, string>> = {
  dependabot: 'Dependabot',
  'code-scanning': 'Code scanning',
  'secret-scanning': 'Secret scanning',
};

/** What each kind's mark in the sky looks like: "rock: dependency". */
export const ALERT_KIND_LEGEND: readonly { readonly key: AlertKind; readonly label: string }[] = [
  { key: 'dependabot', label: 'rock: dependency' },
  { key: 'code-scanning', label: 'shard: code' },
  { key: 'secret-scanning', label: 'spark: secret' },
];

export const SEVERITY_WORDS: Readonly<Record<AlertSeverity, string>> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/** A grade's colour as CSS, for the list, the legend and the belts' names. */
export const severityColour = (severity: AlertSeverity): string => `var(--security-${severity})`;

/** What to say while there is no report to show, or null once there is one. */
export function stateMessage(state: SecurityState): PageMessage | null {
  switch (state.status) {
    case 'reading':
      return { headline: 'Reading the security alerts…' };
    case 'missing':
      return { headline: 'No such project', detail: 'It may be private, or the name is wrong.' };
    case 'unreachable':
      return {
        headline: 'Could not read the security alerts',
        detail: 'GitHub or the API did not answer. Try again in a moment.',
      };
    case 'ready':
      return null;
  }
}

/** What to say when no list could be read, or nothing is open; null while there are alerts. */
export function emptyMessage(report: SecurityReport): PageMessage | null {
  if (openAlertCount(report)) return null;
  if (report.sources.every((source) => source.status !== 'read')) {
    return {
      headline: 'No alerts could be read',
      detail: 'Each list’s note above says why.',
    };
  }
  return { headline: 'No open alerts', detail: 'Nothing GitHub can see needs fixing.' };
}

/** "me/app · 4 open alerts". */
export function securityStamp(repo: string, report: SecurityReport | null): string {
  return report ? `${repo} · ${plural(openAlertCount(report), 'open alert')}` : repo;
}

/** Shown in place of the list for a preview visitor. */
export const WITHHELD_NOTE =
  'This is a preview: it shows how many alerts are open, not what they are. Sign in to see them.';

/** "Dependabot #8 · opened 3d ago". */
export function alertMeta(kind: AlertKind, number: number, createdAt: number, now: number): string {
  return `${KIND_WORDS[kind]} #${number} · opened ${agoWords(createdAt, now)}`;
}

export interface LegendEntry {
  readonly key: AlertSeverity;
  /** "Critical 2". */
  readonly label: string;
  readonly colour: string;
}

/** Each grade's colour and how many of the open alerts have it, for the sky's legend. */
export function severityLegend(sources: readonly AlertSource[]): LegendEntry[] {
  return SEVERITIES.map((severity) => {
    const count = sources.reduce((total, source) => total + source.counts[severity], 0);
    return {
      key: severity,
      label: `${SEVERITY_WORDS[severity]} ${count}`,
      colour: severityColour(severity),
    };
  });
}

/** "Not read: Dependabot, Code scanning. The list says why." Null when all three were. */
export function unreadNote(sources: readonly AlertSource[]): string | null {
  const unread = sources.filter((source) => source.status !== 'read');
  return unread.length
    ? `Not read: ${unread.map((source) => KIND_WORDS[source.kind]).join(', ')}. The list says why.`
    : null;
}
