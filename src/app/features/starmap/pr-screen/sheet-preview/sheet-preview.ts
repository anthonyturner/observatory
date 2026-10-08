import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { PullPreviewFeed } from '../../../../core/deployments/pull-preview-feed';
import { Deployment } from '../../../../core/deployments/deployments-report';
import { outcomeColour } from '../../../deployments/deploy-look';
import { OUTCOME_WORDS, commitWords } from '../../../deployments/deploy-words';

/** One of the head's deployments as the PR screen shows it. */
export interface PreviewRow {
  readonly key: string;
  readonly environment: string;
  readonly outcome: string;
  /** Its dot, coloured as the Deployments sky colours it: a CSS colour. */
  readonly colour: string;
  readonly commit: string;
  readonly siteUrl: string | null;
  /** Only when it is not the site itself, as Vercel gives it. */
  readonly logUrl: string | null;
}

export const previewRows = (deployments: readonly Deployment[]): PreviewRow[] =>
  deployments.map((deployment) => ({
    key: String(deployment.id),
    environment: deployment.environment,
    outcome: OUTCOME_WORDS[deployment.outcome],
    colour: outcomeColour(deployment.outcome),
    commit: commitWords(deployment),
    siteUrl: deployment.url,
    logUrl: deployment.logUrl === deployment.url ? null : deployment.logUrl,
  }));

/**
 * The pull request's head as it was deployed, such as Vercel's preview: its
 * status and a link to the site. Read when the screen opens, never by the
 * queue; draws nothing when the head has not been deployed.
 */
@Component({
  selector: 'app-sheet-preview',
  templateUrl: './sheet-preview.html',
  styleUrl: './sheet-preview.css',
  providers: [PullPreviewFeed],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetPreview {
  private readonly feed = inject(PullPreviewFeed);

  /** `owner/name`. */
  readonly repo = input.required<string>();
  /** The head commit. */
  readonly sha = input.required<string>();

  protected readonly rows = computed(() => previewRows(this.feed.deployments()));

  constructor() {
    effect(() => this.feed.load(this.repo(), this.sha()));
  }
}
