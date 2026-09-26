import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HudSection } from '../../../shared/hud-section/hud-section';

/** The assistant: where a question is typed or spoken, and its replies. */
@Component({
  selector: 'app-ask-panel',
  imports: [HudSection],
  template: '<app-hud-section heading="Ask" note="type or talk" />',
  styles: ':host { display: block; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AskPanel {}
