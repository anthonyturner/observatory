import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProjectBarSize } from '../../core/project-bar/project-bar-size';

/** An empty box the size of the project bar floating over it, so a page's header
 *  lays out around the bar as if the bar were part of its flow. */
@Component({
  selector: 'app-project-bar-room',
  template: '',
  styleUrl: './project-bar-room.css',
  host: {
    '[style.width.px]': 'size().width',
    '[style.height.px]': 'size().height',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectBarRoom {
  protected readonly size = inject(ProjectBarSize).room;
}
