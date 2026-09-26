import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HudSection } from '../../../../shared/hud-section/hud-section';
import { DirectiveList as DirectiveListData } from '../../data/vitals';

/** The top of the blocked-first queue across every project, as a checklist. */
@Component({
  selector: 'app-directive-list',
  imports: [HudSection],
  templateUrl: './directive-list.html',
  styleUrl: './directive-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectiveList {
  readonly directives = input.required<DirectiveListData>();
}
