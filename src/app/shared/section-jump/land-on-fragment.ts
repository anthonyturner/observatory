import { Injector, Signal, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationSkipped, Router } from '@angular/router';
import { filter, startWith, switchMap, take } from 'rxjs';
import { SectionJump } from './section-jump';

/**
 * Lands on the section `id` names when the page's address ends in `#id`, such
 * as a notice's link to Home's Mail, once `isShown` says the section is on the
 * page. It lands again each time such a link is followed, including when the
 * address already ends in it and the router skips the navigation. Called from
 * the page's constructor.
 */
export function landOnFragment(id: string, isShown: Signal<boolean>): void {
  const router = inject(Router);
  const sections = inject(SectionJump);
  const injector = inject(Injector);
  const shown = toObservable(isShown).pipe(filter(Boolean), take(1));
  router.events
    .pipe(
      filter((event) => event instanceof NavigationEnd || event instanceof NavigationSkipped),
      startWith(null),
      filter(() => router.parseUrl(router.url).fragment === id),
      switchMap(() => shown),
      takeUntilDestroyed(),
    )
    .subscribe(() => afterNextRender(() => sections.land(id), { injector }));
}
