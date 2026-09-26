import { Injectable, Injector, effect, inject, untracked } from '@angular/core';
import { PushToTalk } from '../../voice/push-to-talk';
import { ERROR_HOLD_MS } from '../core-holds';
import { CORE_STATE_WRITER } from '../core-state-tokens';
import { CoreStateSource } from '../core-state.types';

/** The mic on the core: listening while it records, working while the
 *  recording is turned into text, and an error when voice cannot run. */
@Injectable()
export class TalkCoreSource implements CoreStateSource {
  private readonly talk = inject(PushToTalk);
  private readonly writer = inject(CORE_STATE_WRITER);
  private readonly injector = inject(Injector);

  connect(): void {
    effect(
      () => {
        const isRecording = this.talk.isRecording();
        const isWorking = this.talk.isWorking();
        untracked(() => this.follow(isRecording, isWorking));
      },
      { injector: this.injector },
    );
    effect(
      () => {
        if (this.talk.isBlocked()) untracked(() => this.writer.flash('error', ERROR_HOLD_MS));
      },
      { injector: this.injector },
    );
  }

  /** A turn that ends leaves the core to whatever took over, such as the
   *  request its words were sent as. */
  private follow(isRecording: boolean, isWorking: boolean): void {
    if (isRecording) {
      this.writer.show('listening');
    } else if (isWorking) {
      this.writer.show('transcribing');
    } else {
      this.writer.end('listening');
      this.writer.end('transcribing');
    }
  }
}
