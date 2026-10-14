import { afterNextRender, DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ELEMENT_SIZE } from '../element-size/element-size';

/**
 * Publishes the element's height as a custom property on the page's root, so CSS
 * elsewhere can keep clear of it at whatever size it has, and takes the property
 * away with the element: `<div appPublishHeight="--tools-height">`.
 */
@Directive({ selector: '[appPublishHeight]' })
export class PublishHeight {
  /** The property's name. It is read once, when the element first renders. */
  readonly property = input.required<string>({ alias: 'appPublishHeight' });

  constructor() {
    const sizeOf = inject(ELEMENT_SIZE);
    const element = inject<ElementRef<Element>>(ElementRef).nativeElement;
    const root = inject(DOCUMENT).documentElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const property = this.property();
      sizeOf(element)
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe(({ height }) => root.style.setProperty(property, `${height}px`));
    });
    destroyRef.onDestroy(() => root.style.removeProperty(this.property()));
  }
}
