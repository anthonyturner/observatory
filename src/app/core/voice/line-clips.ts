import { Injectable, Signal, computed, inject } from '@angular/core';
import { ActiveVoice, Speaker } from './active-voice';
import { ANNOUNCEMENT_VOICE } from './announcement-voice';
import { SPEECH_ENGINES, joinedClips } from './chosen-engine';
import { SpeakPreference } from './speak-preference';
import { SpokenClip } from './voice-protocol';

const noop = (): void => undefined;

/** Who made a clip: Kokoro, or one ElevenLabs voice. A clip is only played in the voice that made it. */
const speakerKey = (speaker: Speaker): string =>
  speaker.engine === 'kokoro' ? 'kokoro' : `elevenlabs:${speaker.voice?.id ?? ''}`;

const keyOf = (speaker: Speaker, text: string): string => `${speakerKey(speaker)}|${text}`;

/**
 * Fixed lines of speech, made once and kept, so a line said again costs no
 * synthesis (ElevenLabs bills per character) and no wait.
 *
 * A line is made only while Speak is on, in the voice now chosen, one at a time
 * and never while a line is being read. It is never made with a question about
 * downloading the voice model: an engine that is not ready, or that fails,
 * makes no clip, and the line is simply not there to play.
 */
@Injectable({ providedIn: 'root' })
export class LineClips {
  private readonly engines = inject(SPEECH_ENGINES);
  private readonly active = inject(ActiveVoice);
  private readonly preference = inject(SpeakPreference);
  private readonly voice = inject(ANNOUNCEMENT_VOICE);
  private readonly made = new Map<string, SpokenClip>();
  private readonly waiting: string[] = [];
  private isMaking = false;
  private making: string | null = null;

  /** Who would make a clip now. It changes with the voice, which is when the lines want making again. */
  readonly speaker: Signal<string> = computed(() => speakerKey(this.active.speaker()));

  /** The clip of `text` in the voice now speaking, if it is made. If not, it is
   *  queued to be made and this answers null: ask again later. */
  clipOf(text: string): SpokenClip | null {
    const clip = this.made.get(keyOf(this.active.speaker(), text));
    if (!clip) this.prepare([text]);
    return clip ?? null;
  }

  /** Queues those of `texts` that are not made, to be made one after another. */
  prepare(texts: readonly string[]): void {
    const speaker = this.active.speaker();
    for (const text of texts) {
      const isQueued = this.making === text || this.waiting.includes(text);
      if (!isQueued && !this.made.has(keyOf(speaker, text))) this.waiting.push(text);
    }
    if (!this.isMaking) void this.makeWaiting();
  }

  private async makeWaiting(): Promise<void> {
    this.isMaking = true;
    try {
      while (this.waiting.length && this.preference.isOn() && !this.voice.isBusy()) {
        this.making = this.waiting.shift() ?? '';
        await this.make(this.making);
      }
    } finally {
      // What is left asks again the next time it is wanted.
      this.waiting.length = 0;
      this.making = null;
      this.isMaking = false;
    }
  }

  /** A line that cannot be made is dropped, as `announce` drops one it cannot say. */
  private async make(text: string): Promise<void> {
    try {
      const engine = this.engines[this.active.speaker().engine];
      const warmUp = await engine.warmUp({ takesFocus: false, mayAsk: false, onAgreed: noop });
      if (warmUp !== 'ready') return;
      // Read after warming up: an ElevenLabs voice is known only once the account's are read.
      const speaker = this.active.speaker();
      if (this.engines[speaker.engine] !== engine) return;
      const clips: SpokenClip[] = [];
      for (const part of engine.parts(text)) clips.push(await engine.synthesize(part));
      if (clips.length) this.made.set(keyOf(speaker, text), joinedClips(clips));
    } catch {
      return;
    }
  }
}
