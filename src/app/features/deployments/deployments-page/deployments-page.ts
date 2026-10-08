import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { map } from 'rxjs';
import { DeploymentsFeed } from '../../../core/deployments/deployments-feed';
import { DeployOutcome } from '../../../core/deployments/deployments-report';
import { ProjectTabs } from '../../../shared/project-tabs/project-tabs';
import { UpLink } from '../../../shared/up-link/up-link';
import { SkyInsets } from '../../releases/release-sky/release-sky';
import { DeployList } from '../deploy-list/deploy-list';
import { outcomeColour } from '../deploy-look';
import { OUTCOME_WORDS, deploymentsStamp, emptyMessage, stateMessage } from '../deploy-words';
import { LaunchSky } from '../launch-sky/launch-sky';

export type DeploymentsView = 'sky' | 'list';

/** The header's height, which the sky keeps clear of, and the playlist dock along the foot. */
const INSETS: SkyInsets = { top: 170, right: 0, bottom: 110, left: 0 };
const LEGEND: readonly DeployOutcome[] = ['ready', 'building', 'failed', 'inactive'];

const repoOf = (params: ParamMap): string =>
  `${params.get('owner') ?? ''}/${params.get('repo') ?? ''}`;

/**
 * A project's Deployments: each environment's latest deployment and the ones
 * before it, as launch pads in a sky or as a list, each linked to its site
 * and its commit.
 */
@Component({
  selector: 'app-deployments-page',
  imports: [UpLink, ProjectTabs, LaunchSky, DeployList],
  providers: [DeploymentsFeed],
  templateUrl: './deployments-page.html',
  styleUrls: ['../../releases/releases-page/releases-page.css', './deployments-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeploymentsPage {
  private readonly feed = inject(DeploymentsFeed);
  private readonly repoChanges = inject(ActivatedRoute).paramMap.pipe(map(repoOf));

  protected readonly repo = toSignal(this.repoChanges, { initialValue: '' });
  protected readonly view = signal<DeploymentsView>('sky');
  protected readonly insets = INSETS;
  protected readonly legend = LEGEND.map((outcome) => ({
    key: outcome,
    label: OUTCOME_WORDS[outcome],
    colour: outcomeColour(outcome),
  }));

  protected readonly report = computed(() => {
    const state = this.feed.state();
    return state.status === 'ready' ? state.report : null;
  });
  protected readonly message = computed(() => {
    const report = this.report();
    return stateMessage(this.feed.state()) ?? (report ? emptyMessage(report) : null);
  });
  protected readonly stamp = computed(() => deploymentsStamp(this.repo(), this.report()));

  constructor() {
    this.repoChanges.pipe(takeUntilDestroyed()).subscribe((repo) => this.feed.load(repo));
  }

  protected refresh(): void {
    this.feed.refresh();
  }
}
