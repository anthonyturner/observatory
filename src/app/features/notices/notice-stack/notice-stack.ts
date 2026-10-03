import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  computed,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { NoticeBoard } from '../../../core/notices/notice-board';
import { PlaylistPlacement } from '../../../core/playlist/playlist-placement';
import { NoticeCard } from '../notice-card/notice-card';
import { noticeView } from '../notice-view';

const JUMP_KEY = 'F8';
/** Where focus goes when nothing else will take it: Home's top. */
const TOP_ID = 'top';
const LINK = 'a[href]';

/**
 * The notices on every page, under the clock. A notice never takes focus as
 * it arrives: F8 goes to the newest, and Esc there dismisses it. Both listen
 * as the key travels down from the window, ahead of every page's own keys, so
 * the page never also acts on that Esc.
 */
@Component({
  selector: 'app-notice-stack',
  imports: [NoticeCard],
  templateUrl: './notice-stack.html',
  styleUrl: './notice-stack.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoticeStack {
  protected readonly board = inject(NoticeBoard);
  protected readonly motion = inject(MotionPreference);
  protected readonly placement = inject(PlaylistPlacement);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  /** Where focus was when F8 moved it here, to go back to. */
  private returnTo: HTMLElement | null = null;

  protected readonly views = computed(() => this.board.notices().map(noticeView));

  constructor() {
    const window = this.document.defaultView;
    if (!window) return;
    fromEvent<KeyboardEvent>(window, 'keydown', { capture: true })
      .pipe(takeUntilDestroyed())
      .subscribe((event) => this.onKeydown(event));
  }

  /** Dismisses a notice; focus inside it moves to the next, the one before, or back. */
  protected dismiss(id: number): void {
    const hadFocus = this.noticeElement(id)?.contains(this.document.activeElement) ?? false;
    const next = this.neighbourOf(id);
    this.board.dismiss(id);
    if (hadFocus) this.moveFocus(next);
  }

  protected onFocusOut(event: FocusEvent): void {
    const to = event.relatedTarget;
    if (!(to instanceof Node) || !this.host.contains(to)) this.board.setFocusWithin(false);
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === JUMP_KEY && !hasModifier(event)) {
      this.jumpToNewest(event);
    } else if (event.key === 'Escape') {
      this.dismissFocused(event);
    }
  }

  private jumpToNewest(event: KeyboardEvent): void {
    const newest = this.board.notices().at(-1);
    const link = newest ? this.firstLinkOf(newest.id) : null;
    if (!link) return;
    event.preventDefault();
    const active = this.document.activeElement;
    if (active instanceof HTMLElement && !this.host.contains(active)) this.returnTo = active;
    link.focus();
  }

  private dismissFocused(event: KeyboardEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const notice = target.closest<HTMLElement>('[data-notice]');
    if (!notice || !this.host.contains(notice)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.dismiss(Number(notice.dataset['notice']));
  }

  private neighbourOf(id: number): number | null {
    const ids = this.board.notices().map((notice) => notice.id);
    const at = ids.indexOf(id);
    return ids[at + 1] ?? ids[at - 1] ?? null;
  }

  private moveFocus(next: number | null): void {
    const target = (next === null ? null : this.firstLinkOf(next)) ?? this.fallbackFocus();
    if (target) target.focus();
    else if (this.document.activeElement instanceof HTMLElement) this.document.activeElement.blur();
  }

  private fallbackFocus(): HTMLElement | null {
    const back = this.returnTo;
    this.returnTo = null;
    if (back?.isConnected) return back;
    return this.document.getElementById(TOP_ID);
  }

  private noticeElement(id: number): HTMLElement | null {
    return this.host.querySelector<HTMLElement>(`[data-notice="${id}"]`);
  }

  private firstLinkOf(id: number): HTMLElement | null {
    return this.noticeElement(id)?.querySelector<HTMLElement>(LINK) ?? null;
  }
}

const hasModifier = (event: KeyboardEvent): boolean =>
  event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
