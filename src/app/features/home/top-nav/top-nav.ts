import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { SoundPreference } from '../../../core/sound/sound-preference';
import { HelpState } from '../../../shared/help/help-state';
import { SectionJump } from '../../../shared/section-jump/section-jump';
import { RunPill } from '../run-pill/run-pill';

/** A section further down Home that the menu jumps to. */
interface Jump {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
}

const JUMPS: readonly Jump[] = [
  { id: 'news', label: 'News', hint: 'Jump to the AI and software engineering news' },
  { id: 'projects', label: 'Projects', hint: 'Jump to your project cards' },
];

/** A task's pill, jumps to Home's sections, the way to the orrery, and the page's tools. */
@Component({
  selector: 'app-top-nav',
  imports: [RouterLink, RunPill],
  templateUrl: './top-nav.html',
  styleUrl: './top-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopNav {
  protected readonly help = inject(HelpState);
  protected readonly motion = inject(MotionPreference);
  protected readonly sound = inject(SoundPreference);
  protected readonly sections = inject(SectionJump);
  protected readonly jumps = JUMPS;
  protected readonly motionHint = computed(() =>
    this.motion.choice() === 'auto'
      ? 'Following your system setting — click to override'
      : 'Overriding your system setting — click to switch',
  );
}
