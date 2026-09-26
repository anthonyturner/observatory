import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** An element's width in CSS pixels, now and each time it changes. */
export type WidthOf = (element: Element) => Observable<number>;

/** Widths from the browser's ResizeObserver; tests supply their own. */
export const ELEMENT_WIDTH = new InjectionToken<WidthOf>('ELEMENT_WIDTH', {
  providedIn: 'root',
  factory: () => (element) =>
    new Observable<number>((subscriber) => {
      const observer = new ResizeObserver(([entry]) => subscriber.next(entry.contentRect.width));
      observer.observe(element);
      return () => observer.disconnect();
    }),
});
