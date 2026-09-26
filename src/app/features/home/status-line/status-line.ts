import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StatusItem } from '../data/home-summary';

/** A row of readings: core state, where the site runs, projects tracked. */
@Component({
  selector: 'app-status-line',
  templateUrl: './status-line.html',
  styleUrl: './status-line.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusLine {
  readonly items = input.required<readonly StatusItem[]>();
}
