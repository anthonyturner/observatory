import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { fromEvent, map, startWith, combineLatest } from 'rxjs';
import { footClearanceOf } from './core/playlist/foot-clearance';
import { PlaylistPlacement } from './core/playlist/playlist-placement';
import { TransportBar } from './features/playlist/transport-bar/transport-bar';
import { ELEMENT_SIZE, ElementSize } from './shared/element-size/element-size';
import { PreviewBanner } from './shared/preview-banner/preview-banner';

const NO_SIZE: ElementSize = { width: 0, height: 0 };

/** The shell: the routed page, and the playlist outside it, so the music and its
 *  video carry on from page to page without reloading. Every page's tools and cards
 *  at the foot keep clear of it through `--playlist-clear-right` and
 *  `--playlist-clear-bottom`, and `--playlist-height`. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PreviewBanner, TransportBar],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly placement = inject(PlaylistPlacement);
  private readonly foot = viewChild.required<ElementRef<HTMLElement>>('foot');

  constructor() {
    const sizeOf = inject(ELEMENT_SIZE);
    const document = inject(DOCUMENT);
    const root = document.documentElement;
    const window = document.defaultView;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const windowWidth = window
        ? fromEvent(window, 'resize').pipe(
            startWith(null),
            map(() => window.innerWidth),
          )
        : [root.clientWidth];
      // The video and track list float over the bar's far end, outside its box.
      const foot = this.foot().nativeElement;
      const above = foot.querySelector('.above');
      combineLatest([sizeOf(foot), above ? sizeOf(above) : [NO_SIZE], windowWidth])
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe(([bar, aboveBar, width]) => {
          const clearance = footClearanceOf(bar, aboveBar, width);
          root.style.setProperty('--playlist-height', `${bar.height}px`);
          root.style.setProperty('--playlist-clear-right', `${clearance.right}px`);
          root.style.setProperty('--playlist-clear-bottom', `${clearance.bottom}px`);
        });
    });
  }
}
