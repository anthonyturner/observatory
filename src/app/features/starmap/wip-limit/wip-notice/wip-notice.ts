import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WipCheck } from '../wip-check';

/** The gentle word above the tools, clear of the search's suggestions when more is open than the viewer's limit. */
@Component({
  selector: 'app-wip-notice',
  templateUrl: './wip-notice.html',
  styleUrl: './wip-notice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WipNotice {
  readonly check = input.required<WipCheck>();
}
