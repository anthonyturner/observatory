import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** An element's outer size in CSS pixels, padding and border included. */
export interface ElementSize {
  readonly width: number;
  readonly height: number;
}

/** An element's outer size, now and each time it changes. */
export type SizeOf = (element: Element) => Observable<ElementSize>;

/** Sizes from the browser's ResizeObserver; tests supply their own. */
export const ELEMENT_SIZE = new InjectionToken<SizeOf>('ELEMENT_SIZE', {
  providedIn: 'root',
  factory: () => (element) =>
    new Observable<ElementSize>((subscriber) => {
      const observer = new ResizeObserver(([entry]) => {
        const [box] = entry.borderBoxSize;
        subscriber.next({ width: box.inlineSize, height: box.blockSize });
      });
      observer.observe(element);
      return () => observer.disconnect();
    }),
});
