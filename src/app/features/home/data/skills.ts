import { InjectionToken, Signal, signal } from '@angular/core';

/** A fixed task the assistant can propose in one press. */
export interface Skill {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  /** The project it runs in, when it names one. */
  readonly project?: string;
}

const SAMPLE_SKILLS: readonly Skill[] = [
  {
    id: 'queue',
    label: 'Triage the review queue',
    description: 'The blocked-first queue of open pull requests, with what to do first.',
  },
  {
    id: 'blocked',
    label: 'Summarise what’s blocked',
    description: 'Each open pull request that cannot merge yet, why, and the smallest next step.',
  },
  {
    id: 'stale',
    label: 'Find stale PRs',
    description: 'Open pull requests with no activity for a week or more.',
  },
  {
    id: 'failures',
    label: 'Explain today’s failures',
    description: 'Why the checks that failed in the last 24 hours failed.',
  },
  {
    id: 'release-notes',
    label: 'Draft release notes',
    description: 'Notes for everything merged since the last tag.',
    project: 'observatory',
  },
  {
    id: 'deps',
    label: 'Check dependency updates',
    description: 'Which dependencies are behind, and which updates look safe.',
    project: 'observatory',
  },
];

/** Where Home reads its skills from: sample data until the live source lands. */
export const SKILLS = new InjectionToken<Signal<readonly Skill[]>>('SKILLS', {
  providedIn: 'root',
  factory: () => signal(SAMPLE_SKILLS).asReadonly(),
});
