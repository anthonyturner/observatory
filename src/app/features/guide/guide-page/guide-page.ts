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
import { map } from 'rxjs';
import { DOCS_BOOKS } from '../../../core/guide/docs-books';
import { guideMatching, guideOf, sectionCount } from '../../../core/guide/guide';
import { searchTerms } from '../../../core/library/library-search';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { UpLink } from '../../../shared/up-link/up-link';
import { DocBlocks, HEADING_ID_PREFIX } from '../../library/doc-blocks/doc-blocks';
import { LibraryIndex } from '../../library/library-index/library-index';
import { Reading, contentsOf, emptyLineOf, matchesElsewhere, resultLineOf } from './guide-view';

const FILTER_LABEL = 'Filter every doc';

/**
 * The docs area's one page, at `/docs/:book`: the book's Markdown read with
 * the Library's parser and drawn with its blocks, beside contents that list
 * every book (the open one in full), a filter across every book's sections,
 * and an anchor per section so a screen's Guide link lands on its own part.
 * Angular keeps this one component when only the book changes, so the
 * filter's words stay when a result opens another book: the results stay in
 * the contents to step through, and the section opened is one of them.
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
  private readonly books = inject(DOCS_BOOKS);
  private readonly route = inject(ActivatedRoute);
  private readonly slug = toSignal(this.route.paramMap.pipe(map((params) => params.get('book'))), {
    requireSync: true,
  });
  private readonly fragment = toSignal(this.route.fragment, { initialValue: null });

  private readonly readings: readonly Reading[] = this.books.map((book) => ({
    book,
    guide: computed(() => guideOf(book.markdown)),
  }));
  /** The book the address names; the route sends an unknown address to the Guide first. */
  private readonly openReading = computed(
    () => this.readings.find(({ book }) => book.slug === this.slug()) ?? this.readings[0],
  );
  protected readonly book = computed(() => this.openReading().book);
  protected readonly filterLabel = FILTER_LABEL;
  /** Where the reader was sent: a book, and the section within it if the address names one. */
  private readonly place = computed(() => ({ book: this.book().slug, fragment: this.fragment() }));

  protected readonly isStill = inject(MotionPreference).isStill;
  protected readonly query = signal('');
  /** On a narrow screen the contents fold away above the text. */
  protected readonly isIndexOpen = signal(false);

  private readonly terms = computed(() => searchTerms(this.query()));
  /** The open book's parts and sections that the filter leaves, for the reading column. */
  protected readonly shown = computed(() =>
    guideMatching(this.openReading().guide(), this.terms()),
  );
  private readonly elsewhere = computed(() =>
    matchesElsewhere(this.readings, this.book(), this.terms()),
  );
  protected readonly shelves = computed(() =>
    contentsOf({
      readings: this.readings,
      open: this.book(),
      terms: this.terms(),
      currentId: this.fragment(),
    }),
  );
  protected readonly resultLine = computed(() =>
    resultLineOf(
      { here: sectionCount(this.shown()), elsewhere: this.elsewhere() },
      this.terms(),
      this.book().name,
    ),
  );
  protected readonly emptyLine = computed(() => emptyLineOf(this.book().name, this.elsewhere()));

  constructor() {
    afterRenderEffect({ write: () => this.showSection(this.place().fragment) });
  }

  protected toggleIndex(): void {
    this.isIndexOpen.update((isOpen) => !isOpen);
  }

  /**
   * Brings the section a link named into view and gives its heading the focus;
   * with no section named, a book just opened starts at its top, with the focus
   * on its text, since the contents entry that opened it is no longer there.
   */
  private showSection(fragment: string | null): void {
    const column = this.reading()?.nativeElement;
    if (!column) return;
    const target = fragment && column.ownerDocument.getElementById(HEADING_ID_PREFIX + fragment);
    if (!target) {
      column.scrollTop = 0;
      column.focus({ preventScroll: true });
      return;
    }
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  }
}
