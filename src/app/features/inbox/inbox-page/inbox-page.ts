import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { InboxFeed } from '../../../core/inbox/inbox-feed';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { ProjectsFeed } from '../../../core/projects/projects-feed';
import { messageOf } from '../../../core/runs/runs-api';
import { UpLink } from '../../../shared/up-link/up-link';
import { PageMessage } from '../../releases/releases-page/releases-words';
import { InboxList } from '../inbox-list/inbox-list';
import { inboxGroups } from '../inbox-view';
import { emptyMessage, inboxStamp, stateMessage } from '../inbox-words';

const NO_PROJECTS: ReadonlySet<string> = new Set();

/** What a mark says if GitHub refuses it, and what to undo once it is done either way. */
interface MarkOutcome {
  readonly refused: string;
  readonly settle: () => void;
}

/**
 * The Inbox: the owner's unread GitHub notifications across every repository,
 * by repository and then reason, each opening its PR screen or issue window
 * when its project is charted, else GitHub; one or all marked read from here.
 */
@Component({
  selector: 'app-inbox-page',
  imports: [UpLink, InboxList],
  templateUrl: './inbox-page.html',
  styleUrls: ['../../releases/releases-page/releases-page.css', './inbox-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxPage {
  private readonly feed = inject(InboxFeed);
  private readonly projects = inject(ProjectsFeed);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isStill = inject(MotionPreference).isStill;
  /** Threads whose Mark read is on its way to GitHub. */
  protected readonly marking = signal<ReadonlySet<string>>(new Set());
  protected readonly isMarkingAll = signal(false);
  /** Why GitHub refused the last mark; null after one that went through. */
  protected readonly refusal = signal<string | null>(null);

  protected readonly report = computed(() => {
    const state = this.feed.state();
    return state.status === 'ready' ? state.report : null;
  });
  private readonly tracked = computed(() => {
    const state = this.projects.state();
    if (state.status !== 'ready') return NO_PROJECTS;
    return new Set(state.report.projects.map((project) => project.repo.toLowerCase()));
  });
  protected readonly groups = computed(() => {
    const report = this.report();
    return report ? inboxGroups(report.items, this.tracked(), report.generatedAt) : [];
  });
  protected readonly message = computed((): PageMessage | null => {
    const report = this.report();
    return stateMessage(this.feed.state()) ?? (report ? emptyMessage(report) : null);
  });
  protected readonly stamp = computed(() => inboxStamp(this.report()));
  protected readonly canMarkAll = computed(
    () => !this.isMarkingAll() && (this.report()?.items.length ?? 0) > 0,
  );

  protected refresh(): void {
    this.feed.refresh();
  }

  protected markRead(threadId: string): void {
    this.marking.update((ids) => new Set([...ids, threadId]));
    this.send(this.feed.markRead(threadId), {
      refused: 'Couldn’t mark it read',
      settle: () => this.marking.update((ids) => new Set([...ids].filter((id) => id !== threadId))),
    });
  }

  protected markAllRead(): void {
    this.isMarkingAll.set(true);
    this.send(this.feed.markAllRead(), {
      refused: 'Couldn’t mark them read',
      settle: () => this.isMarkingAll.set(false),
    });
  }

  /** Sends a mark, then settles, saying why if GitHub refused it. */
  private send(mark: Observable<void>, { refused, settle }: MarkOutcome): void {
    this.refusal.set(null);
    mark.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      complete: settle,
      error: (error: unknown) => {
        this.refusal.set(`${refused}: ${messageOf(error)}.`);
        settle();
      },
    });
  }
}
