import {
  EMPTY,
  Observable,
  combineLatest,
  distinctUntilChanged,
  interval,
  of,
  startWith,
  switchMap,
} from 'rxjs';

/** `read`, now and every `everyMs`, while the page is shown. Hidden, it stops
 *  asking; shown again, or given a new interval, it reads at once and carries on. */
export function whileVisibleEvery<T>(
  isHidden: Observable<boolean>,
  everyMs: Observable<number>,
  read: () => Observable<T>,
): Observable<T> {
  return combineLatest([isHidden, everyMs.pipe(distinctUntilChanged())]).pipe(
    switchMap(([hidden, ms]) =>
      hidden
        ? EMPTY
        : interval(ms).pipe(
            startWith(0),
            switchMap(() => read()),
          ),
    ),
  );
}

/** `read`, now and every `everyMs`, while the page is shown. */
export function whileVisible<T>(
  isHidden: Observable<boolean>,
  everyMs: number,
  read: () => Observable<T>,
): Observable<T> {
  return whileVisibleEvery(isHidden, of(everyMs), read);
}
