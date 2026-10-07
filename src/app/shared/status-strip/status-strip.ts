import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  inject,
  input,
} from '@angular/core';
import { StatusStripFold } from '../../core/status-strip/status-strip-fold';
import { STATUS_FACT, STATUS_STRIP_VIEW, StatusStripView } from './status-fact';

/** A slim glass strip floating over every page, holding the facts projected
 *  into it. It hides while none of them has anything to show, and folds to a
 *  compact chip, remembered in this browser. */
@Component({
  selector: 'app-status-strip',
  templateUrl: './status-strip.html',
  styleUrl: './status-strip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STATUS_STRIP_VIEW, useExisting: StatusStrip }],
  host: { '[attr.hidden]': 'hasFacts() ? null : ""' },
})
export class StatusStrip implements StatusStripView {
  private readonly fold = inject(StatusStripFold);
  private readonly facts = contentChildren(STATUS_FACT, { descendants: true });

  /** The fold toggle's accessible name; it says open or folded through aria-expanded. */
  readonly label = input.required<string>();

  readonly isCollapsed = this.fold.isFolded;
  protected readonly hasFacts = computed(() => this.facts().some((fact) => fact.isShown()));

  protected toggle(): void {
    this.fold.toggle();
  }
}
