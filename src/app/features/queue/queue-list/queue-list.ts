import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { QueueSection } from '../queue-view';

/** The review queue as a list: a section per bucket, a row per pull request. */
@Component({
  selector: 'app-queue-list',
  templateUrl: './queue-list.html',
  styleUrl: './queue-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueueList {
  readonly sections = input.required<readonly QueueSection[]>();
  /** Asks to open a pull request's panel. */
  readonly picked = output<number>();
}
