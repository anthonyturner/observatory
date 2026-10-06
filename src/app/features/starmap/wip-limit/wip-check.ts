import { QueueItem } from '../../../core/queue/queue-report';

/** How the open work stands against the viewer's limit. */
export interface WipCheck {
  /** Open pull requests that are not drafts. */
  readonly open: number;
  readonly limit: number;
  /** Past the limit: a nudge to finish something before starting more. */
  readonly isOver: boolean;
}

/** Drafts are left out; snoozed and dismissed ones still count, since they are still open. */
export function wipCheck(items: readonly QueueItem[], limit: number): WipCheck {
  const open = items.filter((item) => !item.isDraft).length;
  return { open, limit, isOver: open > limit };
}
