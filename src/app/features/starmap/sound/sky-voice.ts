import { DestroyRef, Injectable, computed, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, timer } from 'rxjs';
import { AGENT_SPEECH_API } from '../../../core/agent-speech/agent-speech-api';
import { JevIdle } from '../../../core/assistant/jev-idle';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { PageVisibility } from '../../../core/presence/page-visibility';
import { ViewerSession } from '../../../core/session/viewer-session';
import { ANNOUNCEMENT_VOICE } from '../../../core/voice/announcement-voice';
import { LineClips } from '../../../core/voice/line-clips';
import { SpeakPreference } from '../../../core/voice/speak-preference';
import { Resolution } from '../memory/departure-company';
import { ExitStart } from '../memory/exits';
import { Undock } from '../memory/undock';
import { Play, ReadyLine, placeLines } from './line-plan';
import { PREPARED_LINES, RESOLVED_LINE, endingLine, farewellFor } from './sky-lines';

/** How long after its moment each kind of line may still start, in seconds.
 *  "Resolved!" is the planets turning green and must not trail them; a ship is
 *  still flying home a couple of seconds after it casts off. */
const LATE_S = { resolved: 0.4, ending: 0.5, farewell: 2.5 } as const;

/** Farewells in one refresh: more would be a crowd talking over the ending. */
const MAX_FAREWELLS = 2;

const wallSeconds = (): number => performance.now() / 1000;

interface Wanted {
  readonly text: string;
  readonly at: number;
  readonly lateS: number;
}

const earliest = (times: readonly number[]): number => Math.min(...times);

/**
 * Jev, in the announcement voice, says short fixed lines as the sky changes:
 * "Resolved!" as planets turn green, a line for how pull requests ended, and a
 * farewell from the ships and satellites that fly home.
 *
 * Each hook says when its line should land, and a line is heard only if it can
 * be heard then: Speak on, the tab in view, this machine, Jev and Agent Speak
 * both quiet, and its clip already made. A line that cannot is dropped, never
 * held, because a late "Resolved!" misleads. It never asks to download the voice
 * model; with none ready, the sky is silent.
 *
 * The three hooks are called in the order their lines are heard (resolved,
 * exited, undocked), because each line starts after those already placed.
 */
@Injectable({ providedIn: 'root' })
export class SkyVoice {
  private readonly clips = inject(LineClips);
  private readonly voice = inject(ANNOUNCEMENT_VOICE);
  private readonly isJevIdle = inject(JevIdle).isIdle;
  private readonly agent = inject(AGENT_SPEECH_API);
  private readonly speakOn = inject(SpeakPreference).isOn;
  private readonly hidden = inject(PageVisibility).isHidden;
  private readonly isStill = inject(MotionPreference).isStill;
  private readonly isLocal = inject(ViewerSession).isConfirmedLocal;
  private readonly destroyRef = inject(DestroyRef);
  /** Only this machine speaks unasked: the hosted site's voice is the owner's to pay for. */
  private readonly canHear = computed(() => this.isLocal() && this.speakOn() && !this.hidden());
  /** When the lines already placed are done, in wall seconds. */
  private freeAt = 0;

  constructor() {
    // Ready before the first is wanted, and again whenever the voice changes.
    effect(() => {
      this.clips.speaker();
      if (this.canHear()) untracked(() => this.clips.prepare(PREPARED_LINES));
    });
  }

  /** The planets of these pull requests turn green: "Resolved!" once, as the first does. */
  resolved(resolutions: readonly Resolution[]): void {
    if (!resolutions.length) return;
    const at = earliest(resolutions.map((each) => each.startAt));
    this.say([{ text: RESOLVED_LINE, at, lateS: LATE_S.resolved }]);
  }

  /** These pull requests' stars begin to go: one line for how they ended, as the first does. */
  exited(starts: readonly ExitStart[]): void {
    const text = endingLine(starts.map((each) => each.kind));
    if (text === null) return;
    const at = earliest(starts.map((each) => each.startAt));
    this.say([{ text, at, lateS: LATE_S.ending }]);
  }

  /** Ships and satellites cast off: a farewell from the first few, each as it goes.
   *  With motion off nothing flies home, so nobody says goodbye. */
  undocked(undocks: readonly Undock[]): void {
    if (this.isStill()) return;
    this.say(
      undocks.slice(0, MAX_FAREWELLS).map((each) => ({
        text: farewellFor(each.key),
        at: each.startAt,
        lateS: LATE_S.farewell,
      })),
    );
  }

  private say(lines: readonly Wanted[]): void {
    if (!this.canHear()) return;
    const ready = lines.flatMap(({ text, ...when }): ReadyLine[] => {
      const clip = this.clips.clipOf(text);
      return clip ? [{ clip, ...when }] : [];
    });
    const { plays, freeAt } = placeLines(ready, this.freeAt, wallSeconds());
    this.freeAt = freeAt;
    plays.forEach((play) => this.playAt(play));
  }

  /** Asks Agent Speak as the line is due, then plays it if everything is still quiet. */
  private playAt(play: Play): void {
    timer(Math.max(0, (play.startAt - wallSeconds()) * 1000))
      .pipe(
        switchMap(() => this.agent.isBusy()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((isAgentBusy) => {
        if (!isAgentBusy && this.mayPlay(play)) this.voice.announceClip(play.clip);
      });
  }

  private mayPlay({ at, lateS }: Play): boolean {
    return this.canHear() && this.isJevIdle() && wallSeconds() - at <= lateS;
  }
}
