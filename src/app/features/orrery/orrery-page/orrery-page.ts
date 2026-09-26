import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { orreryStamp } from '../../../core/orrery/orrery-stamp';
import { layoutWorlds } from '../../../core/orrery/world-layout';
import { PROJECTS, PROJECTS_STATE } from '../../../core/projects/projects-source';
import { Clock } from '../../../core/time/clock';
import { OrreryCanvas } from '../orrery-canvas/orrery-canvas';
import { OrreryTools } from '../orrery-tools/orrery-tools';
import { WorldCard } from '../world-card/world-card';

/** What the page says in place of the system, by where the projects stand. */
const WAITING_MESSAGE = {
  reading: 'Reading your projects from GitHub…',
  unreachable: 'Projects out of reach: is the API running (npm start)?',
} as const;

/** The orrery: every project as a world in one system, round a sun of open work. */
@Component({
  selector: 'app-orrery-page',
  imports: [RouterLink, OrreryCanvas, OrreryTools, WorldCard],
  templateUrl: './orrery-page.html',
  styleUrl: './orrery-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'selected.set(null)' },
})
export class OrreryPage {
  private readonly router = inject(Router);
  private readonly state = inject(PROJECTS_STATE);
  private readonly now = inject(Clock).now;
  private readonly projects = inject(PROJECTS);

  protected readonly selected = signal<string | null>(null);
  protected readonly worlds = computed(() => layoutWorlds(this.projects()));
  protected readonly selectedWorld = computed(
    () => this.worlds().find((world) => world.project.repo === this.selected()) ?? null,
  );
  protected readonly stamp = computed(() => orreryStamp(this.state(), this.now().getTime()));
  protected readonly waiting = computed(() => {
    const state = this.state();
    if (state.status !== 'ready') return WAITING_MESSAGE[state.status];
    return state.report.projects.length
      ? null
      : 'No worlds yet: the signed-in GitHub account owns no repositories.';
  });

  /** A world's review queue, one level down; Back returns here. */
  protected openQueue(repo: string): void {
    void this.router.navigateByUrl(`/p/${repo}`);
  }

  /** Home opens at the project's card, which Home brings into view. */
  protected showOnHome(repo: string): void {
    void this.router.navigate(['/'], { queryParams: { project: repo } });
  }
}
