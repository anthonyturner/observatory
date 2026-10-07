import { CrewContext, crewTaskOf, crewViewOf } from '../../../core/crew/crew-roster';
import { QueueItem } from '../../../core/queue/queue-report';
import { standingOf } from '../next-star';
import { skyItemOf } from '../sky-items';
import { lowerFirst } from './queue-top';

/** What Jev does with a request for a crew, once he knows the pull request. */
export type CrewVerdict =
  /** Asks whether to send the crew. */
  | { readonly kind: 'send'; readonly question: string }
  /** A crew has nothing to fix there, so he asks whether to open it instead. */
  | { readonly kind: 'open'; readonly question: string }
  /** Says why no crew can go now. */
  | { readonly kind: 'say'; readonly text: string };

/** How the crews stand for one pull request, as Send crew reads them. */
export type CrewStanding = Omit<CrewContext, 'task'>;

/**
 * What Jev does about sending a crew to `item`, named `name`, by Send crew's
 * own rules: a failing or conflicted pull request, one crew at a time, and
 * one task on the runner at a time. A merged stacked base is not read here,
 * so only those two buckets qualify.
 */
export function crewVerdictOf(
  name: string,
  item: QueueItem | undefined,
  standing: CrewStanding,
): CrewVerdict {
  if (!item) return { kind: 'say', text: `That one isn’t open any more: ${name}.` };
  const send = crewViewOf({ ...standing, task: crewTaskOf(item.bucket, null) })?.send ?? null;
  if (!send) {
    const stands = lowerFirst(standingOf(skyItemOf(item)));
    return {
      kind: 'open',
      question: `A crew only takes a failing or conflicted pull request, and this one isn’t: ${stands}. Want me to open ${name} instead?`,
    };
  }
  if (send.isDisabled) return { kind: 'say', text: send.hint };
  return { kind: 'send', question: `Send a crew to ${name}? ${send.hint}` };
}
