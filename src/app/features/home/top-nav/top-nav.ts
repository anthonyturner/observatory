import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { SoundPreference } from '../../../core/sound/sound-preference';
import { HelpState } from '../../../shared/help/help-state';
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
  private readonly document = inject(DOCUMENT);
  protected readonly jumps = JUMPS;
  protected readonly motionHint = computed(() =>
    this.motion.choice() === 'auto'
      ? 'Following your system setting — click to override'
      : 'Overriding your system setting — click to switch',
  );

  /** Scrolls to the section, gliding unless motion is off, and moves focus there so the
   *  keyboard carries on from it. The address is left as it is. */
  protected jumpTo(event: MouseEvent, id: string): void {
    const section = this.document.getElementById(id);
    if (!section || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    section.scrollIntoView({ behavior: this.motion.isStill() ? 'auto' : 'smooth', block: 'start' });
    section.focus({ preventScroll: true });
  }
}
