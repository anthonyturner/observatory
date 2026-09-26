import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PROJECTS } from '../../../core/projects/projects-source';
import { compareProjects, severitySummary } from '../../../core/projects/severity';
import { ProjectCard } from '../project-card/project-card';

/** Below the HUD: a card per project, blocked first. */
@Component({
  selector: 'app-fleet-section',
  imports: [ProjectCard],
  templateUrl: './fleet-section.html',
  styleUrl: './fleet-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetSection {
  private readonly projects = inject(PROJECTS);

  protected readonly ordered = computed(() => [...this.projects()].sort(compareProjects));
  protected readonly summary = computed(() => severitySummary(this.projects()));
}
