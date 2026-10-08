import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  output,
} from '@angular/core';
import { Router } from '@angular/router';
import { InboxRowView, RepoGroupView } from '../inbox-view';

/** A row being marked read, and the row whose button takes focus once it has gone. */
interface FocusHandOver {
  readonly gone: string;
  readonly next: string | null;
}

const markButton = (id: string): string => `button.mark[data-id="${CSS.escape(id)}"]`;

/**
 * The unread notifications as a list: a section per repository, a heading per
 * reason, and a row per thread with its own Mark read button. A row's beacon
 * pulses while it asks something of you, and holds still when motion is off.
 */
@Component({
  selector: 'app-inbox-list',
  templateUrl: './inbox-list.html',
  styleUrl: './inbox-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.still]': 'isStill()' },
})
export class InboxList {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private handOver: FocusHandOver | null = null;

  readonly groups = input.required<readonly RepoGroupView[]>();
  /** Threads whose Mark read is on its way to GitHub. */
  readonly marking = input.required<ReadonlySet<string>>();
  readonly isStill = input.required<boolean>();
  /** A thread's id, to mark read. */
  readonly markRead = output<string>();

  constructor() {
    // A marked row leaves the list; the keyboard carries on from its neighbour.
    afterRenderEffect(() => {
      this.groups();
      this.marking();
      this.passFocus();
    });
  }

  /** A plain click on a row that opens inside Observatory stays in the app; any other keeps the browser's own. */
  protected follow(event: MouseEvent, row: InboxRowView): void {
    if (!row.isInside || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    event.preventDefault();
    void this.router.navigateByUrl(row.href);
  }

  /** Marks a row read. A pending one stays focusable, rather than disabled, so focus is not dropped. */
  protected mark(id: string): void {
    if (this.marking().has(id)) return;
    this.handOver = { gone: id, next: this.neighbourOf(id) };
    this.markRead.emit(id);
  }

  /** The next row's id, or the one before when it was the last. */
  private neighbourOf(id: string): string | null {
    const ids = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLButtonElement>('button.mark'),
      (button) => button.dataset['id'] ?? '',
    );
    const at = ids.indexOf(id);
    return ids[at + 1] ?? ids[at - 1] ?? null;
  }

  private passFocus(): void {
    const handOver = this.handOver;
    if (!handOver) return;
    const root = this.host.nativeElement;
    if (root.querySelector(markButton(handOver.gone))) {
      // Still listed and no longer being marked: GitHub refused, so focus stays where it is.
      if (!this.marking().has(handOver.gone)) this.handOver = null;
      return;
    }
    this.handOver = null;
    if (handOver.next) root.querySelector<HTMLElement>(markButton(handOver.next))?.focus();
  }
}
