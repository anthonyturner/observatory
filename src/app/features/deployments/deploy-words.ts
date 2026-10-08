import { DeploymentsState } from '../../core/deployments/deployments-feed';
import {
  DeployOutcome,
  Deployment,
  DeploymentsReport,
  shortSha,
} from '../../core/deployments/deployments-report';
import { plural } from '../../shared/text/plural';
import { agoWords } from '../actions/actions-words';
import { PageMessage } from '../releases/releases-page/releases-words';

/* How the Deployments screen and the PR screen name a deployment and how it went. */

export const OUTCOME_WORDS: Readonly<Record<DeployOutcome, string>> = {
  ready: 'Ready',
  building: 'Building',
  failed: 'Failed',
  inactive: 'Replaced',
  unknown: 'No status',
};

/** "92b4594", or "92b4594 on main" when it was asked for by branch or tag. */
export const commitWords = (deployment: Deployment): string =>
  deployment.ref ? `${shortSha(deployment.sha)} on ${deployment.ref}` : shortSha(deployment.sha);

/** "Preview · Ready · 92b4594 · 3h ago". */
export const deploymentTip = (deployment: Deployment, now: number): string =>
  [
    deployment.environment,
    OUTCOME_WORDS[deployment.outcome],
    commitWords(deployment),
    agoWords(deployment.createdAt, now),
  ].join(' · ');

/** What a screen reader says for a deployment's mark, and where following it goes. */
export function deploymentSpoken(deployment: Deployment, now: number): string {
  const opens = deployment.url ? 'Opens the deployed site.' : 'Opens the commit on GitHub.';
  return (
    `${deployment.environment}, ${OUTCOME_WORDS[deployment.outcome].toLowerCase()}, ` +
    `commit ${commitWords(deployment)}, ${agoWords(deployment.createdAt, now)}. ${opens}`
  );
}

/** What to say while there is no report to draw, or null once there is one. */
export function stateMessage(state: DeploymentsState): PageMessage | null {
  switch (state.status) {
    case 'reading':
      return { headline: 'Reading the deployments…' };
    case 'missing':
      return { headline: 'No such project', detail: 'It may be private, or the name is wrong.' };
    case 'unreachable':
      return {
        headline: 'Could not read the deployments',
        detail: 'GitHub or the API did not answer. Try again in a moment.',
      };
    case 'ready':
      return null;
  }
}

/** What to say over a sky with nothing in it, or null when it has an environment. */
export const emptyMessage = (report: DeploymentsReport): PageMessage | null =>
  report.environments.length
    ? null
    : {
        headline: 'No deployments yet',
        detail: 'Deployments appear here once something, such as Vercel, posts one to GitHub.',
      };

/** "me/app · 2 environments", or "me/app · 6 of 14 environments" when only the first were read. */
export function deploymentsStamp(repo: string, report: DeploymentsReport | null): string {
  if (!report) return repo;
  const total = plural(report.environmentCount, 'environment');
  const shown = report.environments.length;
  return shown < report.environmentCount ? `${repo} · ${shown} of ${total}` : `${repo} · ${total}`;
}
