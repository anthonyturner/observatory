import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HudSection } from '../../../../shared/hud-section/hud-section';
import { DocTabs as DocTabsData } from '../../data/vitals';

/** The other views, as small outlined tabs. */
@Component({
  selector: 'app-doc-tabs',
  imports: [HudSection, RouterLink],
  templateUrl: './doc-tabs.html',
  styleUrl: './doc-tabs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocTabs {
  readonly docs = input.required<DocTabsData>();
}
