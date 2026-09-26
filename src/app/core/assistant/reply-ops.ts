import { InjectionToken, inject } from '@angular/core';
import { PAGE_REFRESH, RefreshOutcome } from '../projects/projects-refresh';
import { HelpState } from '../../shared/help/help-state';
import { REPLY_VOICE } from '../voice/reply-voice';

/** What an op may do to the reply it answers. */
export interface OpContext {
  /** Says how the op is going, in the reply. */
  say(text: string): void;
  /** Whether sending this request cut off a reply being read aloud. */
  readonly cutSpeech: boolean;
}

/** An app action the page carries out itself, rather than a page to open. */
export type ReplyOp = (context: OpContext) => void | Promise<void>;

const REFRESH_WORDS: Readonly<Record<RefreshOutcome, string>> = {
  done: 'Refreshed every project.',
  busy: 'Already refreshing.',
  failed: 'Refresh failed. Press Refresh to try again.',
};

/** Each `op` the router can send, by name. A new op is one more entry. */
export const REPLY_OPS = new InjectionToken<Readonly<Record<string, ReplyOp>>>('REPLY_OPS', {
  providedIn: 'root',
  factory: () => {
    const page = inject(PAGE_REFRESH);
    const help = inject(HelpState);
    const voice = inject(REPLY_VOICE);
    return {
      refresh: async ({ say }) => {
        say('Refreshing every project…');
        say(REFRESH_WORDS[await page.refresh()]);
      },
      help: ({ say }) => {
        say('Opened the help card.');
        help.open();
      },
      stop: ({ say, cutSpeech }) => {
        const wasSpeaking = voice.stop() || cutSpeech;
        say(wasSpeaking ? 'Stopped speaking.' : 'Nothing is speaking.');
      },
    };
  },
});
