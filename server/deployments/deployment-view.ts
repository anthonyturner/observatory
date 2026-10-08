import type {
  DeploymentMark,
  DeploymentReader,
  DeploymentState,
  DeploymentStatusMark,
} from '../github/deployment-reader.ts';
import type { DeployOutcome, DeploymentView } from './deployments-types.ts';

const OUTCOME_OF_STATE: Readonly<Record<DeploymentState, DeployOutcome>> = {
  success: 'ready',
  queued: 'building',
  pending: 'building',
  in_progress: 'building',
  error: 'failed',
  failure: 'failed',
  inactive: 'inactive',
};

/** How a deployment stands, from its newest status; with none, unknown. */
export const outcomeOf = (status: DeploymentStatusMark | null): DeployOutcome =>
  status ? OUTCOME_OF_STATE[status.state] : 'unknown';

/** One deployment and its newest status, as the screens show it. */
export function deploymentView(
  repo: string,
  mark: DeploymentMark,
  status: DeploymentStatusMark | null,
): DeploymentView {
  return {
    id: mark.id,
    environment: mark.environment,
    sha: mark.sha,
    ref: mark.ref === mark.sha ? null : mark.ref,
    creator: mark.creator,
    createdAt: mark.createdAt,
    statusAt: status?.createdAt ?? null,
    outcome: outcomeOf(status),
    description: status?.description ?? null,
    url: status?.environmentUrl ?? null,
    logUrl: status?.logUrl ?? null,
    commitUrl: `https://github.com/${repo}/commit/${mark.sha}`,
  };
}

/** A status that could not be read leaves its deployment unknown, never the screen empty. */
async function statusOf(
  github: DeploymentReader,
  repo: string,
  id: number,
): Promise<DeploymentStatusMark | null> {
  try {
    return await github.deploymentStatus(repo, id);
  } catch (error: unknown) {
    console.error(`Could not read ${repo}'s deployment ${id}'s status:`, error);
    return null;
  }
}

/** Each deployment with its newest status, read side by side. */
export function withStatuses(
  github: DeploymentReader,
  repo: string,
  marks: readonly DeploymentMark[],
): Promise<DeploymentView[]> {
  return Promise.all(
    marks.map(async (mark) => deploymentView(repo, mark, await statusOf(github, repo, mark.id))),
  );
}

/** Something is still building, so the answer is worth asking for again soon. */
export const isBuilding = (deployments: readonly DeploymentView[]): boolean =>
  deployments.some((deployment) => deployment.outcome === 'building');
