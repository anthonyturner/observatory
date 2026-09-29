import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
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

/** A task's pill, jumps to Home's sections, and the way to the orrery. The
 *  page's tools sit along the foot of the screen instead, as on every screen. */
@Component({
  selector: 'app-top-nav',
  imports: [RouterLink, RunPill],
  templateUrl: './top-nav.html',
  styleUrl: './top-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopNav {
  protected readonly sections = inject(SectionJump);
  protected readonly jumps = JUMPS;
}
