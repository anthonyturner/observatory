import { DeployEnvironment, Deployment } from '../../../core/deployments/deployments-report';
import { agoWords } from '../../actions/actions-words';
import { outcomeColour } from '../deploy-look';
import { OUTCOME_WORDS, commitWords } from '../deploy-words';

/** One deployment as a row of the list. */
export interface DeploymentRow {
  readonly key: string;
  readonly outcome: string;
  /** Its dot, coloured as the sky colours its beacon: a CSS colour. */
  readonly colour: string;
  /** "92b4594", or "92b4594 on main". */
  readonly commit: string;
  readonly commitUrl: string;
  readonly when: string;
  readonly creator: string | null;
  readonly description: string | null;
  readonly siteUrl: string | null;
  /** Only when it is not the site itself, as Vercel gives it. */
  readonly logUrl: string | null;
}

/** One environment as a section of the list. */
export interface EnvironmentSection {
  readonly name: string;
  readonly isProduction: boolean;
  readonly url: string;
  /** Newest first: the first is its latest. */
  readonly rows: readonly DeploymentRow[];
}

function deploymentRow(deployment: Deployment, now: number): DeploymentRow {
  return {
    key: String(deployment.id),
    outcome: OUTCOME_WORDS[deployment.outcome],
    colour: outcomeColour(deployment.outcome),
    commit: commitWords(deployment),
    commitUrl: deployment.commitUrl,
    when: agoWords(deployment.createdAt, now),
    creator: deployment.creator,
    description: deployment.description,
    siteUrl: deployment.url,
    logUrl: deployment.logUrl === deployment.url ? null : deployment.logUrl,
  };
}

/** The environments as the list shows them, `now` being when the report was made. */
export function environmentSections(
  environments: readonly DeployEnvironment[],
  now: number,
): EnvironmentSection[] {
  return environments.map((environment) => ({
    name: environment.name,
    isProduction: environment.isProduction,
    url: environment.url,
    rows: environment.deployments.map((each) => deploymentRow(each, now)),
  }));
}
