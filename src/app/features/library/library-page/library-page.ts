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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, convertToParamMap } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { LibraryFeed } from '../../../core/library/library-feed';
import { pageTextOf, searchTerms } from '../../../core/library/library-search';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { ProjectBarRoom } from '../../../shared/project-bar-room/project-bar-room';
import { plural } from '../../../shared/text/plural';
import { DocArticle } from '../doc-article/doc-article';
import { HEADING_ID_PREFIX } from '../doc-blocks/doc-blocks';
import { LibraryIndex } from '../library-index/library-index';
import { articleOf, currentPage, indexShelves, neighboursOf } from './library-view';
import { PageMessage, libraryNote, libraryStamp, stateMessage } from './library-words';

const repoOf = (params: ParamMap): string =>
  `${params.get('owner') ?? ''}/${params.get('repo') ?? ''}`;

const NO_PAGE: PageMessage = {
  headline: 'No such page',
  detail: 'It may have been renamed or moved. Pick one from the list.',
};

/**
 * A project's Library: its wiki, or its README and docs where it has no
 * wiki, read in the app. The index of pages sits beside the open page.
 */
@Component({
  selector: 'app-library-page',
  imports: [ProjectBarRoom, LibraryIndex, DocArticle],
  providers: [LibraryFeed],
  templateUrl: './library-page.html',
  styleUrls: ['../../releases/releases-page/releases-page.css', './library-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryPage {
  private readonly feed = inject(LibraryFeed);
  private readonly route = inject(ActivatedRoute);
  private readonly reading = viewChild<ElementRef<HTMLElement>>('reading');
  /** The page last shown, so arriving from another page can move the focus and the first one does not. */
  private shownSlug: string | null = null;

  protected readonly isStill = inject(MotionPreference).isStill;
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: convertToParamMap({}),
  });
  private readonly fragment = toSignal(this.route.fragment, { initialValue: null });
  protected readonly repo = computed(() => repoOf(this.params()));
  private readonly slug = computed(() => this.params().get('page') ?? '');
  protected readonly query = signal('');
  /** On a narrow screen the index folds away above the page. */
  protected readonly isIndexOpen = signal(false);

  private readonly report = computed(() => {
    const state = this.feed.state();
    return state.status === 'ready' ? state.report : null;
  });
  private readonly texts = computed(
    () => new Map((this.report()?.pages ?? []).map((page) => [page.slug, pageTextOf(page)])),
  );
  private readonly terms = computed(() => searchTerms(this.query()));
  private readonly page = computed(() => {
    const report = this.report();
    return report ? currentPage(report.pages, this.slug()) : null;
  });
  protected readonly shelves = computed(() =>
    indexShelves({
      repo: this.repo(),
      pages: this.report()?.pages ?? [],
      texts: this.texts(),
      terms: this.terms(),
      currentSlug: this.page()?.slug ?? null,
    }),
  );
  protected readonly resultLine = computed(() => {
    if (!this.terms().length) return null;
    const found = this.shelves().reduce((sum, shelf) => sum + shelf.entries.length, 0);
    return found ? `${plural(found, 'page')} match.` : 'No page matches.';
  });
  protected readonly article = computed(() => {
    const [report, page] = [this.report(), this.page()];
    return report && page ? articleOf(page, report.source) : null;
  });
  protected readonly neighbours = computed(() =>
    neighboursOf(this.report()?.pages ?? [], this.page()?.slug ?? '', this.repo()),
  );
  protected readonly message = computed((): PageMessage | null => {
    const fromState = stateMessage(this.feed.state());
    return fromState ?? (this.report() && !this.page() ? NO_PAGE : null);
  });
  protected readonly hasPages = computed(() => (this.report()?.pages.length ?? 0) > 0);
  protected readonly stamp = computed(() => libraryStamp(this.repo(), this.report()));
  protected readonly note = computed(() => libraryNote(this.report()));
  protected readonly sourceUrl = computed(() => this.report()?.url ?? null);

  constructor() {
    this.route.paramMap
      .pipe(map(repoOf), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((repo) => {
        this.query.set('');
        this.feed.load(repo);
      });
    afterRenderEffect({
      write: () => this.showPlace(this.page()?.slug ?? null, this.fragment()),
    });
  }

  protected toggleIndex(): void {
    this.isIndexOpen.update((isOpen) => !isOpen);
  }

  /** Brings the heading a link named into view, or the top of a newly opened page. */
  private showPlace(slug: string | null, fragment: string | null): void {
    const column = this.reading()?.nativeElement;
    if (!column || slug === null) return;
    const document = column.ownerDocument;
    const target = fragment ? document.getElementById(HEADING_ID_PREFIX + fragment) : null;
    const isNewPage = slug !== this.shownSlug;
    const isArrival = isNewPage && this.shownSlug !== null;
    this.shownSlug = slug;
    if (target) {
      target.scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
      return;
    }
    if (!isNewPage) return;
    column.scrollTop = 0;
    // A link inside the old page took the focus with it; the new page's title takes it instead.
    if (isArrival && document.activeElement === document.body) {
      column.querySelector('h1')?.focus({ preventScroll: true });
    }
  }
}
