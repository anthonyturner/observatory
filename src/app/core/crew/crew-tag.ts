import { CrewTarget } from './crew.types';

/**
 * A crew run's prompt opens with this, then `owner/name#number`. The local API
 * writes it (server/crew/crew-prompt.ts, `CREW_TAG`); the two change together.
 */
const CREW_LINE = /^Observatory crew ship for ([^\s#]+\/[^\s#]+)#(\d+)\b/;

/** The pull request a run's prompt sends a crew to, or null when it is no crew. */
export function crewTargetOf(prompt: string): CrewTarget | null {
  const match = CREW_LINE.exec(prompt);
  if (!match) return null;
  return { repo: match[1], number: Number(match[2]) };
}

/** One key per pull request, whichever repository it is in. */
export const crewKey = (repo: string, number: number): string => `${repo.toLowerCase()}#${number}`;
