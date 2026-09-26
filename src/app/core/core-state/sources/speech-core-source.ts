import { Injectable, Injector, effect, inject, untracked } from '@angular/core';
import { SpokenReplies } from '../../voice/spoken-replies';
import { CORE_STATE_WRITER } from '../core-state-tokens';
import { CoreStateSource } from '../core-state.types';

/** A reply read aloud on the core: speaking, with its tier's arc lit, from
 *  its first sound until it ends. */
@Injectable()
export class SpeechCoreSource implements CoreStateSource {
  private readonly replies = inject(SpokenReplies);
  private readonly writer = inject(CORE_STATE_WRITER);
  private readonly injector = inject(Injector);

  connect(): void {
    effect(
      () => {
        const tier = this.replies.speaking() ? this.replies.tier() : null;
        untracked(() => {
          if (tier) this.writer.speak(tier);
          else this.writer.end('speaking');
        });
      },
      { injector: this.injector },
    );
  }
}
