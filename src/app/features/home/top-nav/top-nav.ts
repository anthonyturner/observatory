import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MAIL_SHOWN } from '../../../core/mail/mail-inbox';
import { SectionJump } from '../../../shared/section-jump/section-jump';
import { RunPill } from '../run-pill/run-pill';

/** A section further down Home that the menu jumps to. */
interface Jump {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
}

const MAIL_JUMP: Jump = {
  id: 'mail',
  label: 'Mail',
  hint: 'Jump to your iCloud and Gmail inboxes',
};

const JUMPS: readonly Jump[] = [
  { id: 'projects', label: 'Projects', hint: 'Jump to your project cards' },
  { id: 'agents', label: 'Agents', hint: 'Jump to what each agent you use costs' },
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
  private readonly hasMail = inject(MAIL_SHOWN);
  /** Mail first, where Home has it: it is the most time-sensitive section. */
  protected readonly jumps = computed(() => (this.hasMail() ? [MAIL_JUMP, ...JUMPS] : JUMPS));
}
