import { CompanyCue, companyCue } from './company-cue';
import { EMBER_ACTS, SinkCue, sinkCue } from './closed-ember';
import { Acts, Beats, CueScene, ExitEvent, beatsOf } from './departure-exit';
import { MERGE_ACTS, MergeCue, mergeCue } from './merge-supernova';
import { ImplosionCue, SQUASH_ACTS, implosionCue } from './squash-collapse';

/* The three exits as one list, and the one place that keeps time with them. A
   merge goes out as a supernova, a squash collapses to a point, a closed pull
   request cools to an ember and sinks into the black hole. Anything that must
   happen in step with an exit (a pull request's planets, a spoken line) reads
   its beats from here instead of keeping a clock of its own. */

/** The sound of one exit's own acts, tagged by which exit it is. */
type ExitSound =
  | { readonly exit: 'merge'; readonly cue: MergeCue }
  | { readonly exit: 'implosion'; readonly cue: ImplosionCue }
  | { readonly exit: 'sink'; readonly cue: SinkCue };

/** What is heard for one exit: its own acts, and the chimes and suction of the company its star kept. */
export type ExitCue = ExitSound & { readonly company: CompanyCue };

interface Exit {
  readonly acts: Acts;
  readonly cue: (ev: ExitEvent, scene: CueScene) => ExitSound;
}

const EXITS: ReadonlyMap<string, Exit> = new Map([
  [
    'merged',
    { acts: MERGE_ACTS, cue: (ev, scene) => ({ exit: 'merge', cue: mergeCue(ev, scene) }) },
  ],
  [
    'squashed',
    {
      acts: SQUASH_ACTS,
      cue: (ev, scene) => ({ exit: 'implosion', cue: implosionCue(ev, scene) }),
    },
  ],
  ['closed', { acts: EMBER_ACTS, cue: (ev, scene) => ({ exit: 'sink', cue: sinkCue(ev, scene) }) }],
]);

/** Whether a kind of news leaves with an exit of its own. */
export const hasExit = (kind: string): boolean => EXITS.has(kind);

/** When an exit's moments fall, in seconds after it starts; null for news that has no exit. */
export function exitBeats(kind: string): Beats | null {
  const exit = EXITS.get(kind);
  return exit ? beatsOf(exit.acts) : null;
}

/**
 * When, on the sky's wall clock, `ev`'s exit reaches `beat`: `'begin'` as its
 * star starts to go, `'turn'` as it hands from its first act to its second, `'end'`
 * as it is over. Null for news that is no exit, or that has not been started.
 */
export function exitBeat(ev: ExitEvent, beat: 'begin' | 'turn' | 'end'): number | null {
  const beats = exitBeats(ev.kind);
  return beats && ev.startAt != null ? ev.startAt + beats[`${beat}S`] : null;
}

/** The ways a pull request exits the sky, which are the endings that have one. */
export type ExitKind = 'merged' | 'squashed' | 'closed';

const isExitKind = (kind: string): kind is ExitKind => EXITS.has(kind);

/** A pull request's star starting to go, for whoever wants to say how it ended. */
export interface ExitStart {
  readonly pr: number;
  readonly kind: ExitKind;
  /** When the star begins to go, in wall seconds (`performance.now() / 1000`). */
  readonly startAt: number;
}

/**
 * Each started exit in the news, once, with the instant its star begins to go.
 * News that has no exit, or has not started, has none.
 */
export function exitStartsOf(
  events: readonly (ExitEvent & { readonly pr: number })[],
): ExitStart[] {
  return events.flatMap((ev) => {
    const startAt = exitBeat(ev, 'begin');
    return isExitKind(ev.kind) && startAt != null ? [{ pr: ev.pr, kind: ev.kind, startAt }] : [];
  });
}

/** More booms than this in one refresh is mud, so the rest play silent. */
const MAX_EXITS_HEARD = 4;

/**
 * The sound for each exit in the news, no more than a few: heard when its star
 * begins to go, from the side of the screen it happens on, and following the
 * path the sky draws. Only an exit the diff found, and that has started, has a
 * cue; nothing here runs on a timer or a guess.
 */
export function exitCues(events: readonly ExitEvent[], scene: CueScene): ExitCue[] {
  return events
    .flatMap((ev) => {
      const exit = EXITS.get(ev.kind);
      return exit && ev.startAt != null
        ? [{ ...exit.cue(ev, scene), company: companyCue(ev, scene) }]
        : [];
    })
    .slice(0, MAX_EXITS_HEARD);
}
