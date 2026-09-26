import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HudSection } from '../../../shared/hud-section/hud-section';
import { levelWeights } from './voice-level';

/** The voice block: its state dots, the level line, Tap to talk and Speak.
 *  Nothing listens or speaks yet; that comes with the assistant. */
@Component({
  selector: 'app-voice-controls',
  imports: [HudSection],
  templateUrl: './voice-controls.html',
  styleUrl: './voice-controls.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceControls {
  protected readonly dashWeights = levelWeights();
}
