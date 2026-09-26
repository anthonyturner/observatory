import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { countBarsOf } from '../../../core/projects/count-bars';
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
  host: { '[style.--sev]': 'severity().color' },
})
export class ProjectCard {
  readonly project = input.required<ProjectSnapshot>();

  protected readonly nameId = `project-card-${nextCardId++}`;
  protected readonly parts = STAR_MAP_PARTS;
  protected readonly severity = computed(() => severityOf(this.project()));
  protected readonly bars = computed(() => countBarsOf(this.project()));
  protected readonly totals = computed(() => totalsOf(this.project()));
  protected readonly gitHubUrl = computed(() => `https://github.com/${this.project().repo}`);
}
