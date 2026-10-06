import { RouteRequest, Source } from './assistant.types';
import { ReplyChip, WAITING_CHIP } from './reply-chip';

/** How a request came in, when it was not typed. */
export type AskedHow = 'typed' | 'spoken' | 'skill';

/** A button under a reply: send a request into this reply again (a pick or
 *  Try again), leave the options (Neither), cancel a page jump, or say words
 *  for you, as a typed request of their own (Yes). */
export type EntryAction =
  | { readonly kind: 'send'; readonly label: string; readonly request: RouteRequest }
  | { readonly kind: 'neither' }
  | { readonly kind: 'stay' }
  | { readonly kind: 'say'; readonly label: string; readonly words: string };

/** What a reply says. A quick answer shows its `inline code` and can be
 *  copied; a note is quieter; `openHref` follows it after Stay here. */
export interface EntrySaid {
  readonly text: string;
  readonly isNote: boolean;
  readonly isAnswer: boolean;
  readonly openHref: string | null;
  /** The pages a web answer drew on, listed under it; never read aloud. */
  readonly sources: readonly Source[];
}

/** One request and its reply, as the feed shows it. */
export interface ReplyEntry {
  readonly id: number;
  readonly asked: string;
  readonly how: AskedHow;
  readonly chip: ReplyChip;
  readonly said: EntrySaid;
  readonly actions: readonly EntryAction[];
}

export const saying = (text: string): EntrySaid => ({
  text,
  isNote: false,
  isAnswer: false,
  openHref: null,
  sources: [],
});

export const noting = (text: string): EntrySaid => ({ ...saying(text), isNote: true });

export const answering = (text: string, sources: readonly Source[] = []): EntrySaid => ({
  ...saying(text),
  isAnswer: true,
  sources,
});

/** A request just sent, waiting on the router. */
export function waitingEntry(id: number, asked: string, how: AskedHow): ReplyEntry {
  return { id, asked, how, chip: WAITING_CHIP, said: saying(''), actions: [] };
}
