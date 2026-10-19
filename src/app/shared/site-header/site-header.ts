import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  WritableSignal,
  viewChild,
  viewChildren,
  afterNextRender,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { combineLatest, filter, map, of, skip, switchMap } from 'rxjs';
import { Disclosure } from '../disclosure/disclosure';
import { ELEMENT_SIZE } from '../element-size/element-size';
import { fitLinks } from './links-fit';
import { NavSection } from './nav-section';
import { SectionLabel } from './section-label';

/** How narrow the project's name may be squeezed, in px, before a link is given up instead. */
const TITLE_FLOOR = 80;

/** Taken off the room for links, in px, so a width that rounds up never pushes the last link off the bar. */
const SAFETY = 1;

/** What the button behind the links shows and says about the screens it holds. */
interface BehindView {
  /** The screens that are in the list and not on the bar. */
  readonly screens: readonly NavSection[];
  /** The page being read is among them. */
  readonly isCurrent: boolean;
  /** A screen has a badge. The closed button shows a dot, with no number: it would read as the page's own. */
  readonly hasDot: boolean;
  /** Every badge, read out after the button's name: "Security: 3 open alerts". */
  readonly spoken: string | null;
}

/**
 * The bar across the top of a page: the logo that goes Home, the page's title, the screen links and,
 * at the right, the controls the page projects: `siteHeaderTool` (Run) and `siteHeaderChip`. It is
 * one row of a fixed height and never wraps. The links that do not fit leave from the right end, in
 * order, and wait behind a More button, which also holds the ways out (`exits`, such as All projects
 * and the Guide) and so is always there. When fewer than three links fit, the links all go behind
 * the one button, which reads as a Menu. The tool and the chip stay on the bar either way, mounted
 * throughout, so what they are doing carries on.
 *
 * The list is the disclosure navigation pattern: plain links, not a `role="menu"`.
 */
@Component({
  selector: 'app-site-header',
  imports: [RouterLink, Disclosure, SectionLabel],
  templateUrl: './site-header.html',
  styleUrl: './site-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // The open list drops below the bar, so the bar rises above the page's drop-downs.
    '[class.open]': 'disclosure().isOpen()',
    '[style.--title-floor.px]': 'titleFloor()',
  },
})
export class SiteHeader {
  private readonly disclosure = viewChild.required(Disclosure);
  private readonly inner = viewChild.required<ElementRef<HTMLElement>>('inner');
  private readonly logo = viewChild.required<ElementRef<HTMLElement>>('logo');
  private readonly end = viewChild.required<ElementRef<HTMLElement>>('end');
  private readonly moreButton = viewChild.required<ElementRef<HTMLElement>>('moreButton');
  private readonly screenLinks = viewChildren<ElementRef<HTMLElement>>('screenLink');

  /** The page's screens, in order, as links. */
  readonly screens = input.required<readonly NavSection[]>();
  /** The ways out of the page, such as All projects: always in the list, below the screens. */
  readonly exits = input<readonly NavSection[]>([]);
  /** Which page this is, beside the logo; nothing is shown when empty. */
  readonly title = input('');

  protected readonly titleFloor = computed(() => (this.title() ? TITLE_FLOOR : 0));

  private readonly innerWidth = signal(0);
  private readonly logoWidth = signal(0);
  private readonly endWidth = signal(0);
  private readonly moreWidth = signal(0);
  private readonly linkWidths = signal<readonly number[]>([]);

  protected readonly isMeasured = computed(() => this.innerWidth() > 0);
  protected readonly fit = computed(() =>
    fitLinks(
      this.innerWidth() - this.logoWidth() - this.titleFloor() - this.endWidth() - SAFETY,
      this.linkWidths(),
      this.moreWidth(),
    ),
  );
  private readonly isMenu = computed(() => this.fit().isMenu);

  protected readonly behind = computed((): BehindView => {
    const screens = this.screens().slice(this.fit().visible);
    const badged = screens.flatMap(({ label, badge }) =>
      badge ? [`${label}: ${badge.spoken}`] : [],
    );
    return {
      screens,
      isCurrent: !this.isMenu() && screens.some((screen) => screen.isCurrent),
      hasDot: badged.length > 0,
      spoken: badged.length ? badged.join(', ') : null,
    };
  });

  constructor() {
    const sizeOf = inject(ELEMENT_SIZE);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const widthOf = (element: ElementRef<HTMLElement>, into: WritableSignal<number>): void => {
        sizeOf(element.nativeElement)
          .pipe(takeUntilDestroyed(destroyRef))
          .subscribe(({ width }) => into.set(width));
      };
      widthOf(this.inner(), this.innerWidth);
      widthOf(this.logo(), this.logoWidth);
      widthOf(this.end(), this.endWidth);
      widthOf(this.moreButton(), this.moreWidth);
    });
    toObservable(this.screenLinks)
      .pipe(
        switchMap((links) =>
          links.length ? combineLatest(links.map((link) => sizeOf(link.nativeElement))) : of([]),
        ),
        map((sizes) => sizes.map(({ width }) => width)),
        takeUntilDestroyed(),
      )
      .subscribe((widths) => this.linkWidths.set(widths));

    toObservable(this.isMenu)
      .pipe(skip(1), takeUntilDestroyed())
      .subscribe(() => this.disclosure().close());
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.disclosure().close());
  }
}
