import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  inject,
  input,
} from '@angular/core';
import { countBarsOf } from '../../../core/projects/count-bars';
import { LitProject } from '../../../core/projects/lit-project';
import { totalsOf } from '../../../core/projects/project-totals';
import { ProjectSnapshot } from '../../../core/projects/project.types';
import { severityOf } from '../../../core/projects/severity';

/** A part of a project's star map the card links to. */
interface StarMapPart {
  readonly label: string;
  readonly hash: string;
}

const STAR_MAP_PARTS: readonly StarMapPart[] = [
  { label: 'PRs', hash: '' },
  { label: 'Issues', hash: '#issues' },
  { label: 'Logs', hash: '#logs' },
  { label: 'Usage', hash: '#usage' },
];

let nextCardId = 0;

/** One project: its worst problem as a colour, what is waiting, and the way in. */
@Component({
  selector: 'app-project-card',
  templateUrl: './project-card.html',
  styleUrl: './project-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--sev]': 'severity().color',
    // Pointing at a card, or tabbing into it, lights its bead on the core.
    '(pointerenter)': 'light()',
    '(pointerleave)': 'unlightUnlessFocused($event)',
    '(focusin)': 'light()',
    '(focusout)': 'unlightUnlessFocusStays($event)',
  },
})
export class ProjectCard {
  readonly project = input.required<ProjectSnapshot>();

  protected readonly nameId = `project-card-${nextCardId++}`;
  protected readonly parts = STAR_MAP_PARTS;
  protected readonly severity = computed(() => severityOf(this.project()));
  protected readonly bars = computed(() => countBarsOf(this.project()));
  protected readonly totals = computed(() => totalsOf(this.project()));
  protected readonly gitHubUrl = computed(() => `https://github.com/${this.project().repo}`);

  private readonly lit = inject(LitProject);
  private readonly document = inject(DOCUMENT);

  protected light(): void {
    this.lit.light(this.project().repo);
  }

  protected unlightUnlessFocused(event: PointerEvent): void {
    const card = event.currentTarget;
    if (card instanceof Element && card.contains(this.document.activeElement)) return;
    this.lit.unlight(this.project().repo);
  }

  protected unlightUnlessFocusStays(event: FocusEvent): void {
    const card = event.currentTarget;
    if (
      card instanceof Element &&
      event.relatedTarget instanceof Node &&
      card.contains(event.relatedTarget)
    ) {
      return;
    }
    this.lit.unlight(this.project().repo);
  }
}
