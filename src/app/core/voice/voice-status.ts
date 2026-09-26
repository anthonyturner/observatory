import { Injectable, Signal, computed, signal } from '@angular/core';

/** The voice block's two buttons, which a status action hands focus back to. */
export type VoiceControlId = 'mic' | 'speak';

export interface StatusAction {
  readonly label: string;
  readonly kind: 'go' | 'quiet' | 'plain';
  readonly run: () => void;
  readonly focusAfter: VoiceControlId;
}

export interface StatusProgress {
  readonly fraction: number;
  readonly label: string;
}

export interface StatusLine {
  readonly words: string;
  /** Trouble says what the viewer must do, so nothing else writes over it. */
  readonly isTrouble: boolean;
  readonly progress: StatusProgress | null;
  readonly actions: readonly StatusAction[];
  /** Whether its first action takes the focus when it shows. */
  readonly takesFocus: boolean;
}

/** The voice block's status line: what voice is doing, or why it cannot.
 *  Empty, it shows the models that are ready. It is not a live region;
 *  VoiceNarration says the parts worth hearing. */
@Injectable({ providedIn: 'root' })
export class VoiceStatus {
  private readonly shown = signal<StatusLine | null>(null);

  readonly line: Signal<StatusLine | null> = this.shown.asReadonly();
  readonly isTroubleShown: Signal<boolean> = computed(() => this.shown()?.isTrouble ?? false);

  show(words: string): void {
    this.shown.set(plain(words));
  }

  showProgress(words: string, progress: StatusProgress): void {
    this.shown.set({ ...plain(words), progress });
  }

  /** A question for the viewer, its answers as actions. */
  ask(words: string, actions: readonly StatusAction[], takesFocus: boolean): void {
    this.shown.set({ ...plain(words), actions, takesFocus });
  }

  showTrouble(words: string, actions: readonly StatusAction[] = []): void {
    this.shown.set({ ...plain(words), isTrouble: true, actions });
  }

  /** Back to saying which models are ready. */
  clear(): void {
    this.shown.set(null);
  }
}

function plain(words: string): StatusLine {
  return { words, isTrouble: false, progress: null, actions: [], takesFocus: false };
}
