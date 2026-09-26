import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PAGE_LOCATION } from '../session/viewer-session';
import { JumpTarget, jumpTargetOf } from './jump-target';
import { ReplySpeech } from './reply-speech';

/** A jump waits this long with Stay here, because a wrong guess lands you
 *  somewhere you did not ask to go. */
export const GRACE_MS = 1000;
/** How long a jump waits past its grace second for its line to be heard, so
 *  a slow voice cannot hold the page back for long. */
export const JUMP_WAIT_MS = 5000;

/** A jump the reply numbered `entryId` has asked for. */
export interface PendingJump {
  readonly entryId: number;
  readonly url: string;
}

const waitAtMost = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Moves the page for a tier-1 action: after the grace second, and after the
 *  reply's spoken line, unless it is cancelled first. */
@Injectable({ providedIn: 'root' })
export class PageJump {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly location = inject(PAGE_LOCATION);
  private readonly speech = inject(ReplySpeech);
  private readonly waiting = signal<PendingJump | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly pending = this.waiting.asReadonly();

  targetOf(href: string): JumpTarget {
    return jumpTargetOf(href, this.document.location.href);
  }

  /** Jumps to `url` once the grace second is up, in place of any jump waiting. */
  schedule(jump: PendingJump): void {
    this.cancel();
    this.waiting.set(jump);
    this.timer = setTimeout(() => void this.land(jump), GRACE_MS);
  }

  cancel(): void {
    clearTimeout(this.timer);
    this.waiting.set(null);
  }

  /** Goes there now: through the router within the app, else by address. */
  go(url: string): void {
    const target = this.targetOf(url);
    if (target.kind === 'away') this.location.assign(target.href);
    else void this.router.navigateByUrl(target.kind === 'page' ? target.url : url);
  }

  private async land(jump: PendingJump): Promise<void> {
    await Promise.race([this.speech.heard(jump.entryId), waitAtMost(JUMP_WAIT_MS)]);
    if (this.waiting() !== jump) return;
    this.waiting.set(null);
    this.go(jump.url);
  }
}
