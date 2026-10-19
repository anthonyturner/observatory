import { ChangeDetectionStrategy, Component } from '@angular/core';

/** An empty box the size of the site bar floating over it, so a page's header lays out around
 *  the bar as if the bar were part of its flow. The bar's place and height are design tokens
 *  (`--site-bar-top`, `--site-bar-height`), so the room is right on the first frame. */
@Component({
  selector: 'app-project-bar-room',
  template: '',
  styleUrl: './project-bar-room.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectBarRoom {}
