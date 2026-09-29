import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProjectJump } from '../../../core/projects/project-jump';
import { ProjectsState } from '../../../core/projects/projects-feed';
import { PROJECTS, PROJECTS_STATE } from '../../../core/projects/projects-source';
import { compareProjects, severitySummary } from '../../../core/projects/severity';
import { TopLink } from '../../../shared/section-jump/top-link';
import { ProjectCard } from '../project-card/project-card';

/** What the section says in place of cards, by where the projects stand. */
const WAITING_MESSAGE: Record<Exclude<ProjectsState['status'], 'ready'>, string> = {
  reading: 'Reading your projects from GitHub…',
  unreachable: 'Projects out of reach: is the API running (npm start)?',
};

/** Home opened for one project (`/?project=owner/repo`, as the orrery links it). */
const PROJECT_PARAM = 'project';

/** Below the HUD: a card per project, blocked first. */
@Component({
  selector: 'app-fleet-section',
  imports: [ProjectCard, TopLink],
  templateUrl: './fleet-section.html',
  styleUrl: './fleet-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetSection {
  private readonly state = inject(PROJECTS_STATE);
  private readonly projects = inject(PROJECTS);
  private readonly jump = inject(ProjectJump);
  private readonly injector = inject(Injector);
  /** The project Home was opened for, until its card has been brought into view. */
  private arriving = inject(ActivatedRoute).snapshot.queryParamMap.get(PROJECT_PARAM);

  protected readonly waiting = computed(() => {
    const { status } = this.state();
    return status === 'ready' ? null : WAITING_MESSAGE[status];
  });
  protected readonly ordered = computed(() => [...this.projects()].sort(compareProjects));
  protected readonly summary = computed(() => severitySummary(this.projects()));

  constructor() {
    effect(() => {
      const key = this.arriving;
      if (!key || !this.projects().some((project) => project.repo === key)) return;
      this.arriving = null;
      // After its card is on the page: a card ignores jumps asked before it existed.
      afterNextRender(() => this.jump.jumpTo(key), { injector: this.injector });
    });
  }
}
