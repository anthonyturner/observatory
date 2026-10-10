import { ChangeDetectionStrategy, Component } from '@angular/core';

/** An empty box the size of the project bar floating over it, so a page's header
 *  lays out around the bar as if the bar were part of its flow. The project shell
 *  publishes the bar's size as `--project-bar-width` and `--project-bar-height`. */
@Component({
  selector: 'app-project-bar-room',
  template: '',
  styleUrl: './project-bar-room.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectBarRoom {}
