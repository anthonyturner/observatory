import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { Disclosure } from '../disclosure/disclosure';
import { NavSection } from './nav-section';
import { SectionLabel } from './section-label';

/** What the menu button shows and says about the sections behind it. */
interface ToggleView {
  /** A section has a badge. The closed button shows a dot, with no number: it would read as the page's own. */
  readonly hasDot: boolean;
  /** Every badge, read out after the button's name: "Security: 3 open alerts". */
  readonly spoken: string | null;
}

/**
 * The bar across the top of a page. At 1200px and wider it is whatever the page
 * projects, laid out as a row. Below that it is a website's header: the logo
 * that goes Home, the page's title and one button that reveals every way of
 * getting around: the `sections` as links, then the projected control marked
 * `siteHeaderTool`. That control is a single element, at the foot of the menu on
 * a narrow window and in the row on a wide one. A closed menu hides it without
 * destroying it, so what it is doing carries on.
 *
 * The menu is the disclosure navigation pattern: plain links, not a `role="menu"`.
 */
@Component({
  selector: 'app-site-header',
  imports: [RouterLink, Disclosure, SectionLabel],
  templateUrl: './site-header.html',
  styleUrl: './site-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // The open menu drops below the bar, so the bar rises above the page's drop-downs.
    '[class.open]': 'menu().isOpen()',
  },
})
export class SiteHeader {
  private readonly menu = viewChild.required(Disclosure);

  /** Where the menu leads, in order. */
  readonly sections = input.required<readonly NavSection[]>();
  /** Which page this is, beside the logo; nothing is shown when empty. */
  readonly title = input('');

  protected readonly toggleView = computed((): ToggleView => {
    const badged = this.sections().flatMap(({ label, badge }) =>
      badge ? [`${label}: ${badge.spoken}`] : [],
    );
    return { hasDot: badged.length > 0, spoken: badged.length ? badged.join(', ') : null };
  });

  constructor() {
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menu().close());
  }
}
