import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InboxFeed } from '../../../core/inbox/inbox-feed';
import { ViewerSession } from '../../../core/session/viewer-session';
import { inboxLinkName } from '../inbox-view';

/**
 * The way to the Inbox, with how many notifications are unread. The count
 * hides at zero; the link hides from a preview visitor: the inbox is not theirs to see.
 */
@Component({
  selector: 'app-inbox-link',
  imports: [RouterLink],
  templateUrl: './inbox-link.html',
  // The agents link's look, shared rather than copied, so the two sit alike on a toolbar.
  styleUrl: '../../agents/live-agents-link/live-agents-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxLink {
  private readonly feed = inject(InboxFeed);

  protected readonly isShown = inject(ViewerSession).canWrite;
  protected readonly count = this.feed.unreadCount;
  protected readonly name = computed(() => inboxLinkName(this.count()));
}
