import { WritableSignal, signal } from '@angular/core';
import { AudioTap } from '../audio-tap';
import { SoundGuide, SoundOption, SoundSource } from '../sound-source.types';

/** A spectrum of one level in every bin, closed or ended by the test. */
export class FakeTap implements AudioTap {
  readonly binHz = 20;
  readonly binCount = 1024;
  closed = false;
  ended: (() => void) | null = null;

  constructor(private readonly level = 200) {}

  read(into: Uint8Array<ArrayBuffer>): void {
    into.fill(this.level);
  }

  onEnded(callback: () => void): void {
    this.ended = callback;
  }

  close(): void {
    this.closed = true;
  }
}

/** A source whose entries the test sets, recording each entry it is asked to open
 *  and answering with `answer`. */
export class FakeSoundSource implements SoundSource {
  readonly name: string;
  readonly guide: SoundGuide;
  readonly options: WritableSignal<readonly SoundOption[]>;
  readonly opened: string[] = [];
  opensWithPlay = true;
  answer: (optionId: string) => Promise<AudioTap> = () => Promise.resolve(new FakeTap());

  constructor(
    readonly id: string,
    options: readonly SoundOption[] = [{ id, label: id }],
  ) {
    this.name = id;
    this.guide = { ask: `Share ${id}.`, silent: `${id} came without sound` };
    this.options = signal(options);
  }

  open(optionId: string): Promise<AudioTap> {
    this.opened.push(optionId);
    return this.answer(optionId);
  }
}
