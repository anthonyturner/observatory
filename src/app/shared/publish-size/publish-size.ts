import { afterNextRender, DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ELEMENT_SIZE } from '../element-size/element-size';

/**
 * Publishes the element's size as custom properties on the page's root, so CSS elsewhere can
 * keep clear of it at whatever size it has, and takes them away with the element:
 * `<div appPublishHeight="--tools-height">`, or both, with `appPublishWidth="--tools-width"`.
 * The names are read once, when the element first renders.
 */
@Directive({ selector: '[appPublishHeight], [appPublishWidth]' })
export class PublishSize {
  readonly heightProperty = input<string>('', { alias: 'appPublishHeight' });
  readonly widthProperty = input<string>('', { alias: 'appPublishWidth' });

  constructor() {
    const sizeOf = inject(ELEMENT_SIZE);
    const element = inject<ElementRef<Element>>(ElementRef).nativeElement;
    const root = inject(DOCUMENT).documentElement;
    const destroyRef = inject(DestroyRef);
    const published: string[] = [];
    afterNextRender(() => {
      const height = this.heightProperty();
      const width = this.widthProperty();
      published.push(...[height, width].filter((name) => name));
      sizeOf(element)
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe((size) => {
          if (height) root.style.setProperty(height, `${size.height}px`);
          if (width) root.style.setProperty(width, `${size.width}px`);
        });
    });
    destroyRef.onDestroy(() => published.forEach((name) => root.style.removeProperty(name)));
  }
}
