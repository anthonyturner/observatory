import { A11yModule } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDE_LINK } from '../../core/guide/guide-link';
import { HelpEntry, HelpKey, helpSections } from './help-entry';
import { HelpState } from './help-state';

/** What a page's parts mean, with a link to the page's part of the Guide for
 *  the longer story. Focus moves in when it opens and back to where it was
 *  when it closes; leaving the page closes it. */
@Component({
  selector: 'app-help-card',
  imports: [A11yModule, RouterLink],
  templateUrl: './help-card.html',
  styleUrl: './help-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpCard {
  protected readonly help = inject(HelpState);
  readonly title = input.required<string>();
  readonly entries = input.required<readonly HelpEntry[]>();
  readonly keys = input.required<readonly HelpKey[]>();
  /** The anchor of this page's part of the Guide, such as `orrery`. */
  readonly guide = input.required<string>();
  protected readonly guideLink = GUIDE_LINK;
  protected readonly sections = computed(() => helpSections(this.entries()));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.help.close());
  }
}
