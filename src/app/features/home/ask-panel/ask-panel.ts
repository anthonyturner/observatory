import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HudSection } from '../../../shared/hud-section/hud-section';
import { AskBar } from '../ask-bar/ask-bar';
import { VoiceControls } from '../voice-controls/voice-controls';

/** The assistant: where a question is typed or spoken, and its replies. */
@Component({
  selector: 'app-ask-panel',
  imports: [HudSection, VoiceControls, AskBar],
  templateUrl: './ask-panel.html',
  styleUrl: './ask-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AskPanel {}
