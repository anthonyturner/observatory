import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { guideMatching, guideOf, sectionCount } from '../../../core/guide/guide';
import { GUIDE_MARKDOWN } from '../../../core/guide/guide-markdown';
import { searchTerms } from '../../../core/library/library-search';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { UpLink } from '../../../shared/up-link/up-link';
import { DocBlocks, HEADING_ID_PREFIX } from '../../library/doc-blocks/doc-blocks';
import { LibraryIndex } from '../../library/library-index/library-index';
import { contentsOf, resultLineOf } from './guide-view';

/**
 * How every part of Observatory works, on one page: the Guide's Markdown read
 * with the Library's parser and drawn with its blocks, its contents the
 * Library's star chart, a filter across every section, and an anchor per
 * section so a screen's Guide link lands on its own part.
 */
@Component({
  selector: 'app-guide-page',
  imports: [UpLink, LibraryIndex, DocBlocks],
  templateUrl: './guide-page.html',
  styleUrls: [
    '../../releases/releases-page/releases-page.css',
    '../../library/library-page/library-page.css',
    './guide-page.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidePage {
  private readonly reading = viewChild<ElementRef<HTMLElement>>('reading');
  private readonly guide = guideOf(inject(GUIDE_MARKDOWN));
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment, { initialValue: null });

  protected readonly isStill = inject(MotionPreference).isStill;
  protected readonly query = signal('');
  /** On a narrow screen the contents fold away above the text. */
  protected readonly isIndexOpen = signal(false);

  private readonly terms = computed(() => searchTerms(this.query()));
  protected readonly shown = computed(() => guideMatching(this.guide, this.terms()));
  protected readonly shelves = computed(() =>
    contentsOf({ guide: this.shown(), terms: this.terms(), currentId: this.fragment() }),
  );
  protected readonly resultLine = computed(() =>
    resultLineOf(sectionCount(this.shown()), this.terms()),
  );

  constructor() {
    afterRenderEffect({ write: () => this.showSection(this.fragment()) });
  }

  protected toggleIndex(): void {
    this.isIndexOpen.update((isOpen) => !isOpen);
  }

  /** Brings the section a link named into view and gives its heading the focus. */
  private showSection(fragment: string | null): void {
    const column = this.reading()?.nativeElement;
    if (!column || !fragment) return;
    const target = column.ownerDocument.getElementById(HEADING_ID_PREFIX + fragment);
    if (!target) return;
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  }
}
