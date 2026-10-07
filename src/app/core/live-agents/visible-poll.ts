import { EMPTY, Observable, interval, startWith, switchMap } from 'rxjs';

/** `read`, now and every `everyMs`, while the page is shown. Hidden, it stops
 *  asking; shown again, it reads at once and carries on. */
export function whileVisible<T>(
  isHidden: Observable<boolean>,
  everyMs: number,
  read: () => Observable<T>,
): Observable<T> {
  return isHidden.pipe(
    switchMap((hidden) =>
      hidden
        ? EMPTY
        : interval(everyMs).pipe(
            startWith(0),
            switchMap(() => read()),
          ),
    ),
  );
}
