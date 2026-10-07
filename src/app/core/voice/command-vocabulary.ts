import { InjectionToken, Signal, computed, inject } from '@angular/core';
import { PROJECTS } from '../projects/projects-source';

/** What the vocabulary needs of a project; a ProjectSnapshot is one. */
export interface VocabularyProject {
  readonly name: string;
  /** `owner/name`. */
  readonly repo: string;
  readonly openPulls?: readonly { readonly number: number }[];
}

/** Words Jev's commands use whatever the projects: first, so a cap on the
 *  list further along never drops them. */
const COMMAND_WORDS: readonly string[] = [
  'Jev',
  'crew',
  'snooze',
  'dismiss',
  'pull request',
  'PR',
  'Next star',
];

const PULL_PREFIX = 'PR ';

const tidy = (term: string): string => term.trim().replace(/\s+/g, ' ');

const repoNameOf = (repo: string): string => repo.slice(repo.lastIndexOf('/') + 1);

/** The terms in order, each once, whatever its case. */
function uniqueOf(terms: readonly string[]): string[] {
  const seen = new Set<string>();
  return terms.filter((term) => {
    const key = term.toLowerCase();
    if (!term || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The words speech-to-text should expect, most needed first: the command
 * words, then each project's name and repository name, then every open pull
 * request as "PR 412".
 */
export function commandVocabulary(projects: readonly VocabularyProject[]): readonly string[] {
  const names = projects.flatMap((project) => [project.name, repoNameOf(project.repo)]);
  const pulls = projects.flatMap((project) =>
    (project.openPulls ?? []).map((pull) => `${PULL_PREFIX}${pull.number}`),
  );
  return uniqueOf([...COMMAND_WORDS, ...names, ...pulls].map(tidy));
}

/** The vocabulary as the text Whisper is primed with, as if it had just heard it. */
export function whisperPromptOf(vocabulary: readonly string[]): string {
  return vocabulary.length ? `${vocabulary.join(', ')}.` : '';
}

/** The vocabulary for the projects read so far; read at each recording. */
export const COMMAND_VOCABULARY = new InjectionToken<Signal<readonly string[]>>(
  'COMMAND_VOCABULARY',
  {
    providedIn: 'root',
    factory: () => {
      const projects = inject(PROJECTS);
      return computed(() => commandVocabulary(projects()));
    },
  },
);
