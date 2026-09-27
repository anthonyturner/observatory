import { Injectable, computed, signal } from '@angular/core';
import { HistoryTurn, RouteReply } from './assistant.types';

/** The most turns sent with a request, and the longest each may be: the
 *  router refuses more. Twelve turns is six exchanges. */
export const TURNS_KEPT = 12;
export const TURN_MAX_LENGTH = 2000;

const clipped = (text: string): string => text.trim().slice(0, TURN_MAX_LENGTH);

/** What a reply said, as a turn of the conversation: Jev's words, or what an action said. */
const answeredWords = (reply: RouteReply): string => reply.text ?? reply.says ?? '';

/** `turns` with one exchange added, the oldest past the cap let go. Whole
 *  exchanges go together, so the conversation always starts with a question. */
export function withExchange(
  turns: readonly HistoryTurn[],
  asked: string,
  answered: string,
): readonly HistoryTurn[] {
  const exchange: HistoryTurn[] = [
    { role: 'user', text: clipped(asked) },
    { role: 'assistant', text: clipped(answered) },
  ];
  return [...turns, ...exchange].slice(-TURNS_KEPT);
}

/** The conversation with Jev on this visit, sent with each typed or spoken
 *  request so Jev remembers it. It lives only as long as the page, since a
 *  request can be private; the router keeps none of it. */
@Injectable({ providedIn: 'root' })
export class Conversation {
  private readonly turns = signal<readonly HistoryTurn[]>([]);

  readonly history = this.turns.asReadonly();
  readonly hasTurns = computed(() => this.turns().length > 0);

  /** Adds what was asked and what the reply said; a reply that said nothing adds nothing. */
  record(asked: string, reply: RouteReply): void {
    const answered = answeredWords(reply);
    if (!asked.trim() || !answered.trim()) return;
    this.turns.update((turns) => withExchange(turns, asked, answered));
  }

  /** Starts a new conversation: Jev forgets the one so far. */
  clear(): void {
    this.turns.set([]);
  }
}
