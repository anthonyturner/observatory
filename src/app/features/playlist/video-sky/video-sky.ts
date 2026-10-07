import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  DestroyRef,
  afterRenderEffect,
  booleanAttribute,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { PlaylistPlayer } from '../../../core/playlist/playlist-player';
import { VideoBackground } from '../../../core/playlist/video-background';

/** The playlist's video filling the window under the page's sky and HUD, while the
 *  bar's Video switch is on. It is there to be watched, so it takes no pointer or focus. */
@Component({
  selector: 'app-video-sky',
  template: '<div #screen class="screen"></div>',
  styleUrl: './video-sky.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', inert: '', '[class.dimmed]': 'dimmed()' },
})
export class VideoSky {
  /** Darkened, so stars drawn over it stay readable. */
  readonly dimmed = input(false, { transform: booleanAttribute });
  private readonly player = inject(PlaylistPlayer);
  private readonly background = inject(VideoBackground);
  private readonly screen = viewChild.required<ElementRef<HTMLElement>>('screen');

  constructor() {
    // Leaving the page hands the video back to the bar, which outlives it.
    inject(DestroyRef).onDestroy(this.background.holdBackdrop());
    afterRenderEffect(() => {
      if (this.background.isShown()) this.player.attach(this.screen().nativeElement);
    });
  }
}
