import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProjectsState } from '../../../core/projects/projects-feed';
import { PROJECTS, PROJECTS_STATE } from '../../../core/projects/projects-source';
import { compareProjects, severitySummary } from '../../../core/projects/severity';
import { ProjectCard } from '../project-card/project-card';

/** What the section says in place of cards, by where the projects stand. */
const WAITING_MESSAGE: Record<Exclude<ProjectsState['status'], 'ready'>, string> = {
  reading: 'Reading your projects from GitHub…',
  unreachable: 'Projects out of reach: is the API running (npm start)?',
};

/** Below the HUD: a card per project, blocked first. */
@Component({
  selector: 'app-fleet-section',
  imports: [ProjectCard],
  templateUrl: './fleet-section.html',
  styleUrl: './fleet-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetSection {
  private readonly state = inject(PROJECTS_STATE);
  private readonly projects = inject(PROJECTS);

  protected readonly waiting = computed(() => {
    const { status } = this.state();
    return status === 'ready' ? null : WAITING_MESSAGE[status];
  });
  protected readonly ordered = computed(() => [...this.projects()].sort(compareProjects));
  protected readonly summary = computed(() => severitySummary(this.projects()));
}
