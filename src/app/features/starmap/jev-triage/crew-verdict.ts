import { CrewContext, crewTaskOf, crewViewOf } from '../../../core/crew/crew-roster';
import { QueueItem } from '../../../core/queue/queue-report';
import { LandedBase } from '../../../core/queue/stacks';
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

/** The pull request a crew is asked for, as the queue and the ledger read it. */
export interface CrewTarget {
  readonly item: QueueItem;
  /** The merge of the base it was stacked on, once that has merged. */
  readonly landed: LandedBase | null;
}

/**
 * What Jev does about sending a crew to `target`, named `name`, by Send
 * crew's own rules: a failing or conflicted pull request, or one stacked on a
 * base that has merged; one crew at a time, and one task on the runner at a
 * time. `target` is undefined once the pull request is no longer open.
 */
export function crewVerdictOf(
  name: string,
  target: CrewTarget | undefined,
  standing: CrewStanding,
): CrewVerdict {
  if (!target) return { kind: 'say', text: `That one isn’t open any more: ${name}.` };
  const task = crewTaskOf(target.item.bucket, target.landed);
  const send = crewViewOf({ ...standing, task })?.send ?? null;
  if (!send) {
    const stands = lowerFirst(standingOf(skyItemOf(target.item)));
    return {
      kind: 'open',
      question: `A crew only takes a pull request that is failing, conflicted or stacked on a base that has merged, and this one isn’t: ${stands}. Want me to open ${name} instead?`,
    };
  }
  if (send.isDisabled) return { kind: 'say', text: send.hint };
  return { kind: 'send', question: `Send a crew to ${name}? ${send.hint}` };
}
