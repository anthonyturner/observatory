/**
 * How a deployment stands: `ready` (live), `building` (queued or under way),
 * `failed`, `inactive` (a newer one replaced it) or `unknown` (no status yet).
 */
export type DeployOutcome = 'ready' | 'building' | 'failed' | 'inactive' | 'unknown';

/** One deployment and how it went. */
export interface DeploymentView {
  readonly id: number;
  readonly environment: string;
  readonly sha: string;
  /** The branch or tag it was asked for; null when that was the commit itself. */
  readonly ref: string | null;
  readonly creator: string | null;
  readonly createdAt: string;
  readonly outcome: DeployOutcome;
  /** The deployer's own words for it, such as "Deployment has completed". */
  readonly description: string | null;
  /** The deployed site. */
  readonly url: string | null;
  readonly logUrl: string | null;
  readonly commitUrl: string;
}

/** One environment and its deployments, newest first: the first is its latest. */
export interface EnvironmentView {
  readonly name: string;
  readonly isProduction: boolean;
  /** Its deployment history on GitHub. */
  readonly url: string;
  readonly deployments: readonly DeploymentView[];
}

/** What `GET /api/deployments` returns. */
export interface DeploymentsReport {
  readonly generatedAt: string;
  readonly repo: string;
  /** Production first, then the most recently deployed. */
  readonly environments: readonly EnvironmentView[];
  /** How many environments the repository has; past a limit only the first are read. */
  readonly environmentCount: number;
}

/** What `GET /api/deployments/preview` returns: what one commit was deployed as. */
export interface PullPreview {
  readonly repo: string;
  readonly sha: string;
  /** The newest deployment of the commit to each environment, newest first. */
  readonly deployments: readonly DeploymentView[];
}
