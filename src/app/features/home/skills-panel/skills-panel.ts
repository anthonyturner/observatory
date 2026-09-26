import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HudSection } from '../../../shared/hud-section/hud-section';

/** One-press tasks the assistant can propose. */
@Component({
  selector: 'app-skills-panel',
  imports: [HudSection],
  template: '<app-hud-section heading="Skills" note="quick access" />',
  styles: ':host { display: block; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkillsPanel {}
