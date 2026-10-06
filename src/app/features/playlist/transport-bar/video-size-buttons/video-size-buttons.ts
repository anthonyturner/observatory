import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { VideoCardSize } from '../../../../core/playlist/video-card-size';

/** Smaller and Bigger in the video card's corner, each a toggle back to the usual size. */
@Component({
  selector: 'app-video-size-buttons',
  templateUrl: './video-size-buttons.html',
  styleUrl: './video-size-buttons.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', 'aria-label': 'Video size' },
})
export class VideoSizeButtons {
  protected readonly size = inject(VideoCardSize);
}
