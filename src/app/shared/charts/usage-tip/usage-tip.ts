import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
} from '@angular/core';
import { Pointer, tipPosition } from './tip-position';

/** What a chart mark's tooltip says, and where the pointer is. */
export interface TipAt {
  readonly text: string;
  readonly pointer: Pointer;
}

/** The tooltip for the chart mark under the pointer: the nearest `data-tip`, or null when none. */
export function tipAt(event: PointerEvent): TipAt | null {
  const target = event.target instanceof Element ? event.target : null;
  const text = target?.closest('[data-tip]')?.getAttribute('data-tip');
  return text ? { text, pointer: { x: event.clientX, y: event.clientY } } : null;
}

/** The one tooltip every usage chart shares, following the pointer. It is
 *  placed after it renders, since where it fits depends on its own size. */
@Component({
  selector: 'app-usage-tip',
  template: '{{ tip()?.text }}',
  styleUrl: './usage-tip.css',
  host: { '[hidden]': '!tip()', role: 'tooltip' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageTip {
  readonly tip = input<TipAt | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly window = inject(DOCUMENT).defaultView;

  constructor() {
    afterRenderEffect({
      earlyRead: () => {
        const tip = this.tip();
        if (!tip) return null;
        const size = { width: this.host.offsetWidth, height: this.host.offsetHeight };
        return tipPosition(tip.pointer, size, this.window?.innerWidth ?? size.width);
      },
      write: (place) => {
        const position = place();
        if (!position) return;
        this.host.style.left = `${position.left}px`;
        this.host.style.top = `${position.top}px`;
      },
    });
  }
}
