import { ErrorHandler, Injectable, inject } from '@angular/core';
import { AskBoxFocus } from './ask-box-focus';
import { RouteReply } from './assistant.types';
import { PageJump } from './page-jump';
import { REPLY_OPS } from './reply-ops';
import { noting, saying } from './reply-entry';
import { ReplyLog } from './reply-log';
import { ReplySpeech } from './reply-speech';

/** Carries out a tier-1 reply, since only the page can move the page: an op
 *  at once, or a jump to another page after the grace second, with Stay here. */
@Injectable({ providedIn: 'root' })
export class TierOneActions {
  private readonly log = inject(ReplyLog);
  private readonly jump = inject(PageJump);
  private readonly speech = inject(ReplySpeech);
  private readonly ops = inject(REPLY_OPS);
  private readonly focus = inject(AskBoxFocus);
  private readonly errors = inject(ErrorHandler);

  /** `cutSpeech` says whether sending this request cut a reply off. */
  carryOut(entryId: number, reply: RouteReply, cutSpeech: boolean): void {
    if (reply.op) this.runOp(entryId, reply.op, cutSpeech);
    else if (reply.href) this.jumpTo(entryId, reply.href, reply.says ?? 'Opening');
    else this.log.say(entryId, noting(reply.text ?? 'Nothing to open.'));
  }

  /** Cancels a jump still waiting, leaving a link to take it after all. */
  stayHere(): void {
    this.cancelJump();
    this.focus.request();
  }

  /** As Stay here, for a new request: the focus stays where it is. */
  cancelJump(): void {
    const pending = this.jump.pending();
    if (!pending) return;
    this.jump.cancel();
    if (this.speech.isSpeaking(pending.entryId)) this.speech.stop();
    this.log.setActions(pending.entryId, []);
    this.log.say(pending.entryId, { ...noting('Stayed here. '), openHref: pending.url });
  }

  private runOp(entryId: number, name: string, cutSpeech: boolean): void {
    const op = this.ops[name];
    if (!op) return;
    const say = (text: string): void => this.log.say(entryId, saying(text));
    Promise.resolve(op({ say, cutSpeech })).catch((error: unknown) => {
      this.errors.handleError(error);
    });
  }

  private jumpTo(entryId: number, href: string, says: string): void {
    if (this.jump.targetOf(href).kind === 'here') {
      this.log.say(entryId, noting('You’re on Home already.'));
      return;
    }
    this.log.say(entryId, saying(`${says}…`));
    this.log.setActions(entryId, [{ kind: 'stay' }]);
    this.jump.schedule({ entryId, url: href });
  }
}
