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
import { PlaylistPlacement } from './core/playlist/playlist-placement';
import { TransportBar } from './features/playlist/transport-bar/transport-bar';
import { ELEMENT_SIZE } from './shared/element-size/element-size';
import { PreviewBanner } from './shared/preview-banner/preview-banner';

/** The shell: the routed page, and the playlist outside it, so the music and its
 *  video carry on from page to page without reloading. The playlist's size goes to
 *  every page as `--playlist-width` and `--playlist-height`, for their own tools
 *  and cards at the foot to keep clear of it. */
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
    const root = inject(DOCUMENT).documentElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() =>
      sizeOf(this.foot().nativeElement)
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe(({ width, height }) => {
          root.style.setProperty('--playlist-width', `${width}px`);
          root.style.setProperty('--playlist-height', `${height}px`);
        }),
    );
  }
}
