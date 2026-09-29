import { BAR_S, Bar, STEP_S, TONIC } from './ambient-score';

/* Home's groove, as plain data: a four-on-the-floor kick, off-beat hats, a
   rolling off-beat bass and a sixteenth-note arpeggio through the chord. Every
   eighth bar the kick and bass drop out for the last measure while a snare
   roll builds, so the loop keeps arriving somewhere. Strain makes it busier:
   sixteenth hats and a brighter, higher arpeggio. */

export type GrooveHit =
  | { readonly kind: 'kick'; readonly offsetS: number; readonly level: number }
  | { readonly kind: 'clap'; readonly offsetS: number; readonly level: number }
  | {
      readonly kind: 'hat';
      readonly offsetS: number;
      readonly level: number;
      readonly open: boolean;
    }
  | { readonly kind: 'bass'; readonly offsetS: number; readonly midi: number }
  | {
      readonly kind: 'arp';
      readonly offsetS: number;
      readonly level: number;
      readonly midi: number;
      readonly pan: number;
    };

export const STEPS = Math.round(BAR_S / STEP_S);
const STEPS_PER_BEAT = 4;
const STEPS_PER_MEASURE = STEPS_PER_BEAT * 4;
/** Which bar of the phrase builds into the next, and from which step. */
const PHRASE_BARS = 8;
const BUILD_FROM = STEPS - STEPS_PER_MEASURE;
/** Chord tones, up and back: the shape that makes a trance arpeggio roll. */
const ARP_ORDER = [0, 1, 2, 3, 2, 1, 3, 2] as const;
const ARP_PAN = 0.35;
const KICK_LEVEL = 0.42;
const CLAP_LEVEL = 0.05;
const OPEN_HAT_LEVEL = 0.03;
const CLOSED_HAT_LEVEL = 0.014;
const ARP_LEVEL = 0.022;
const ROLL_LEVEL = 0.018;
/** From this much strain, closed hats fill the sixteenths between. */
const BUSY_FROM = 0.5;
/** From this much strain, the arpeggio climbs another octave. */
const HIGH_ARP_FROM = 0.75;

/** Whether this bar ends its phrase with a build rather than the beat. */
export const buildsAt = (index: number): boolean => index % PHRASE_BARS === PHRASE_BARS - 1;

/** Everything the groove plays in the bar at `index`; `unease` is 0 to 1. */
export function grooveFor(index: number, bar: Bar, unease = 0): GrooveHit[] {
  const builds = buildsAt(index);
  const hits: GrooveHit[] = [];
  for (let step = 0; step < STEPS; step++) {
    const offsetS = step * STEP_S;
    const inBeat = step % STEPS_PER_BEAT;
    const beat = Math.floor(step / STEPS_PER_BEAT);
    if (builds && step >= BUILD_FROM) {
      hits.push({ kind: 'clap', offsetS, level: ROLL_LEVEL * rise(step) });
    } else {
      if (inBeat === 0) hits.push({ kind: 'kick', offsetS, level: KICK_LEVEL });
      if (inBeat === 0 && beat % 2 === 1) hits.push({ kind: 'clap', offsetS, level: CLAP_LEVEL });
      if (inBeat !== 0) hits.push({ kind: 'bass', offsetS, midi: bar.root + 12 });
    }
    if (inBeat === 2) hits.push({ kind: 'hat', offsetS, level: OPEN_HAT_LEVEL, open: true });
    else if (unease >= BUSY_FROM && inBeat !== 0) {
      hits.push({ kind: 'hat', offsetS, level: CLOSED_HAT_LEVEL, open: false });
    }
    hits.push(arp(step, offsetS, bar, unease));
  }
  return hits;
}

/** The roll swells across the last measure, into the next phrase. */
function rise(step: number): number {
  return 1 + (3 * (step - BUILD_FROM)) / STEPS_PER_MEASURE;
}

function arp(step: number, offsetS: number, bar: Bar, unease: number): GrooveHit {
  const tone = bar.chord[ARP_ORDER[step % ARP_ORDER.length] % bar.chord.length];
  const lift = step % STEPS_PER_MEASURE >= STEPS_PER_MEASURE / 2 ? 12 : 0;
  const high = unease >= HIGH_ARP_FROM ? 12 : 0;
  return {
    kind: 'arp',
    offsetS,
    level: ARP_LEVEL,
    midi: TONIC + 12 + tone + lift + high,
    pan: step % 2 === 0 ? -ARP_PAN : ARP_PAN,
  };
}
