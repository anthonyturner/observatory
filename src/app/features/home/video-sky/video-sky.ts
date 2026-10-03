import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  viewChild,
} from '@angular/core';
import { PlaylistPlayer } from '../../../core/playlist/playlist-player';
import { VideoBackground } from '../../../core/playlist/video-background';

/** The playlist's video filling the window over the sky and under the HUD, while the
 *  bar's Video switch is on. It is there to be watched, so it takes no pointer or focus. */
@Component({
  selector: 'app-video-sky',
  template: '<div #screen class="screen"></div>',
  styleUrl: './video-sky.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', inert: '' },
})
export class VideoSky {
  private readonly player = inject(PlaylistPlayer);
  private readonly background = inject(VideoBackground);
  private readonly screen = viewChild.required<ElementRef<HTMLElement>>('screen');

  constructor() {
    afterRenderEffect(() => {
      if (this.background.isOn()) this.player.attach(this.screen().nativeElement);
    });
  }
}
