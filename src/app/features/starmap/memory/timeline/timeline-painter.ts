import { Frame } from '../../../../core/queue/history-report';
import { LedgerRow } from '../../../../core/queue/ledger';
import { BUCKETS, DAY_MS } from '../../engine/sky-model';

/** The strip's height in CSS pixels, as pr-starmap draws it. */
export const TIMELINE_HEIGHT = 58;

/** Where the days run on the strip, for drawing and for scrubbing. */
export interface TimelineScale {
  readonly rows: readonly LedgerRow[];
  readonly t0: number;
  readonly t1: number;
  readonly width: number;
}

const at = (iso: string): number => Date.parse(iso);

export function timelineScale(rows: readonly LedgerRow[], width: number): TimelineScale {
  return {
    rows,
    t0: new Date(`${rows[0].day}T00:00:00`).getTime(),
    t1: new Date(`${rows[rows.length - 1].day}T23:59:59`).getTime(),
    width,
  };
}

const findLastIndex = <T>(items: readonly T[], test: (item: T) => boolean): number => {
  for (let i = items.length - 1; i >= 0; i--) if (test(items[i])) return i;
  return -1;
};

/** The frame at or before a point on the strip; null for now; undefined before memory began. */
export function frameAtX(
  scale: TimelineScale,
  frames: readonly Frame[],
  x: number,
): number | null | undefined {
  const ms = scale.t0 + (x / scale.width) * (scale.t1 - scale.t0);
  const i = findLastIndex(frames, (f) => at(f.at) <= ms);
  if (i < 0) return undefined;
  return i === frames.length - 1 && ms > at(frames[i].at) + DAY_MS / 2 ? null : i;
}

/** "Sep 26" for a ledger day, kept on its own day wherever the viewer is. */
export const fmtDay = (day: string, locale?: string): string =>
  new Date(day.length === 10 ? `${day}T12:00:00` : day).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });

/** "Sep 26 · 18 open · 2 opened (#598 #599) · 1 merged (#599)". */
export function timelineTip(row: LedgerRow, locale?: string): string {
  const names = (list: readonly number[]): string =>
    list
      .slice(0, 2)
      .map((n) => `#${n}`)
      .join(' ') + (list.length > 2 ? ` +${list.length - 2}` : '');
  return (
    `${fmtDay(row.day, locale)} · ${row.open} open · ${row.opened.length} opened${row.opened.length ? ` (${names(row.opened)})` : ''}` +
    ` · ${row.merged.length} merged${row.merged.length ? ` (${names(row.merged)})` : ''}${row.closed.length ? ` · ${row.closed.length} closed` : ''}`
  );
}

/** "Open pull requests · last 60 days · memory since Sep 23". */
export function timelineCaption(rows: readonly LedgerRow[], frames: readonly Frame[]): string {
  const first = frames[0];
  return `Open pull requests · last ${rows.length - 1} days${first ? ` · memory since ${fmtDay(first.at)}` : ''}`;
}

/**
 * The ledger's days as a ridge of open pull requests, each merge a small
 * green streak falling onto it, each recorded refresh a tick coloured by its
 * worst bucket, your last look a marker and a replay its cursor.
 */
export function paintTimeline(
  c: CanvasRenderingContext2D,
  scale: TimelineScale,
  frames: readonly Frame[],
  lastSeen: string | null,
  replayAt: string | null,
): void {
  const { rows, t0, t1, width: w } = scale;
  const h = TIMELINE_HEIGHT;
  const xOf = (ms: number): number => ((ms - t0) / (t1 - t0)) * w;
  const bw = w / rows.length;
  const max = Math.max(1, ...rows.map((r) => r.open));
  const yOf = (n: number): number => h - 4 - (n / max) * (h - 20);

  // The ridge.
  c.beginPath();
  c.moveTo(0, h);
  rows.forEach((r, i) => c.lineTo(i * bw + bw / 2, yOf(r.open)));
  c.lineTo(w, h);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(142, 162, 255, .32)');
  g.addColorStop(1, 'rgba(142, 162, 255, 0)');
  c.fillStyle = g;
  c.fill();
  c.beginPath();
  rows.forEach((r, i) =>
    i ? c.lineTo(i * bw + bw / 2, yOf(r.open)) : c.moveTo(bw / 2, yOf(r.open)),
  );
  c.strokeStyle = 'rgba(142, 162, 255, .8)';
  c.lineWidth = 1.2;
  c.stroke();

  // Merges as streaks falling onto the ridge; length grows with the count.
  rows.forEach((r, i) => {
    if (!r.merged.length) return;
    const x = i * bw + bw / 2;
    const y = yOf(r.open) - 3;
    const len = 4 + Math.sqrt(r.merged.length) * 4;
    const sg = c.createLinearGradient(x - len * 0.6, y - len, x, y);
    sg.addColorStop(0, 'rgba(95, 227, 161, 0)');
    sg.addColorStop(1, '#5fe3a1');
    c.strokeStyle = sg;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(x - len * 0.6, y - len);
    c.lineTo(x, y);
    c.stroke();
  });

  // Where memory begins: before this line there are counts, not frames.
  if (frames.length) {
    const x = Math.max(1, xOf(at(frames[0].at)));
    c.setLineDash([2, 3]);
    c.strokeStyle = 'rgba(255, 217, 138, .45)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, h);
    c.stroke();
    c.setLineDash([]);
  }

  // One tick per recorded refresh, coloured by its worst bucket.
  for (const f of frames) {
    const worst = BUCKETS.find((b) => f.items.some((i) => i.bucket === b.id));
    c.fillStyle = worst?.colour ?? '#5fe3a1';
    c.fillRect(xOf(at(f.at)) - 1, h - 6, 2, 6);
  }

  // When the viewer last looked.
  if (lastSeen && at(lastSeen) >= t0) {
    const x = xOf(at(lastSeen));
    c.fillStyle = '#8ea2ff';
    c.beginPath();
    c.moveTo(x - 4, 0);
    c.lineTo(x + 4, 0);
    c.lineTo(x, 6);
    c.fill();
  }

  // The replay cursor.
  if (replayAt) {
    const x = xOf(at(replayAt));
    c.strokeStyle = '#ffd98a';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, h);
    c.stroke();
    c.fillStyle = '#ffd98a';
    c.beginPath();
    c.arc(x, 4, 3, 0, Math.PI * 2);
    c.fill();
  }
}
