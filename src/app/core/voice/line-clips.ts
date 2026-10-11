import { Injectable, Signal, computed, inject } from '@angular/core';
import { ActiveVoice } from './active-voice';
import { ANNOUNCEMENT_VOICE } from './announcement-voice';
import { SPEECH_ENGINES, joinedClips } from './chosen-engine';
import { SpeakPreference } from './speak-preference';
import { SpokenClip, VoiceRole } from './voice-protocol';

const noop = (): void => undefined;

interface Line {
  readonly text: string;
  readonly role: VoiceRole;
}

const sameLine = (a: Line, b: Line): boolean => a.text === b.text && a.role === b.role;

/**
 * Fixed lines of speech, made once and kept, so a line said again costs no
 * synthesis (ElevenLabs bills per character) and no wait.
 *
 * A line is made only while Speak is on, in the voice now chosen for its role
 * (Jev's, or the crew's), one at a time and never while a line is being read.
 * It is never made with a question about downloading the voice model: an
 * engine that is not ready, or that fails, makes no clip, and the line is
 * simply not there to play.
 */
@Injectable({ providedIn: 'root' })
export class LineClips {
  private readonly engines = inject(SPEECH_ENGINES);
  private readonly active = inject(ActiveVoice);
  private readonly preference = inject(SpeakPreference);
  private readonly voice = inject(ANNOUNCEMENT_VOICE);
  private readonly made = new Map<string, SpokenClip>();
  private readonly waiting: Line[] = [];
  private isMaking = false;
  private making: Line | null = null;

  /** Who would make a clip now, in either role. It changes with the voices, which is when the lines want making again. */
  readonly speaker: Signal<string> = computed(
    () => `${this.voiceOf('jev')}+${this.voiceOf('crew')}`,
  );

  /** The clip of `text` in the voice now speaking `role`, if it is made. If
   *  not, it is queued to be made and this answers null: ask again later. */
  clipOf(text: string, role: VoiceRole = 'jev'): SpokenClip | null {
    const clip = this.made.get(this.keyOf({ text, role }));
    if (!clip) this.prepare([text], role);
    return clip ?? null;
  }

  /** Queues those of `texts` that are not made, to be made one after another. */
  prepare(texts: readonly string[], role: VoiceRole = 'jev'): void {
    for (const text of texts) {
      const line = { text, role };
      const isQueued =
        (this.making !== null && sameLine(this.making, line)) ||
        this.waiting.some((waiting) => sameLine(waiting, line));
      if (!isQueued && !this.made.has(this.keyOf(line))) this.waiting.push(line);
    }
    if (!this.isMaking) void this.makeWaiting();
  }

  private async makeWaiting(): Promise<void> {
    this.isMaking = true;
    try {
      while (this.waiting.length && this.preference.isOn() && !this.voice.isBusy()) {
        const line = this.waiting.shift();
        if (!line) break;
        this.making = line;
        await this.make(line);
      }
    } finally {
      // What is left asks again the next time it is wanted.
      this.waiting.length = 0;
      this.making = null;
      this.isMaking = false;
    }
  }

  /** A line that cannot be made is dropped, as `announce` drops one it cannot say. */
  private async make(line: Line): Promise<void> {
    try {
      const engine = this.engines[this.active.speaker().engine];
      const warmUp = await engine.warmUp({ takesFocus: false, mayAsk: false, onAgreed: noop });
      if (warmUp !== 'ready') return;
      // Read after warming up: an ElevenLabs voice is known only once the account's are read.
      if (this.engines[this.active.speaker().engine] !== engine) return;
      const key = this.keyOf(line);
      const clips: SpokenClip[] = [];
      for (const part of engine.parts(line.text)) {
        clips.push(await engine.synthesize(part, line.role));
      }
      if (clips.length) this.made.set(key, joinedClips(clips));
    } catch {
      return;
    }
  }

  /** Who speaks `role` now: Kokoro (it picks the voice for the role), or one
   *  ElevenLabs voice. A clip is only played in the voice that made it, and
   *  the crew shares Jev's clips when it shares his voice. */
  private voiceOf(role: VoiceRole): string {
    return this.active.speaker().engine === 'kokoro'
      ? `kokoro:${role}`
      : `elevenlabs:${this.active.elevenLabsVoiceFor(role)?.id ?? ''}`;
  }

  private keyOf({ text, role }: Line): string {
    return `${this.voiceOf(role)}|${text}`;
  }
}
