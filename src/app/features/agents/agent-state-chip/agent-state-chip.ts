import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { LiveAgentState } from '../../../core/live-agents/live-agents.types';

/** An agent's state as the run dock shows a run's: a coloured word, its dot
 *  pulsing while it works unless motion is off. */
@Component({
  selector: 'app-agent-state-chip',
  template: `<span class="state" [attr.data-state]="state()">{{ text() }}</span>`,
  styleUrl: './agent-state-chip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.still]': 'motion.isStill()' },
})
export class AgentStateChip {
  readonly state = input.required<LiveAgentState>();
  /** "Quiet 14 min": the words, worked out by whoever has the agent. */
  readonly text = input.required<string>();

  protected readonly motion = inject(MotionPreference);
}
