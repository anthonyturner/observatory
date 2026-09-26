import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';
import { ASK_CHANNEL } from '../assistant/ask-channel';

/** Sends what the mic heard exactly as typed words would be sent, once any
 *  request already on its way has landed. */
@Injectable({ providedIn: 'root' })
export class TranscriptSender {
  private readonly channel = inject(ASK_CHANNEL);
  private readonly idle = toObservable(this.channel.busy).pipe(filter((busy) => !busy));

  async send(text: string): Promise<void> {
    if (this.channel.busy()) await firstValueFrom(this.idle);
    this.channel.submit(text, { spoken: true });
  }
}
