import type { GitHubReader, PullRequest } from '../github/github-reader.ts';

const ATTEMPTS = 3;
const RETRY_WAIT_MS = 2500;

export type Sleep = (ms: number) => Promise<void>;

const sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GitHub works mergeability out lazily and forgets it for every open pull
 * request whenever the base branch moves, so a list read just after a merge
 * says `UNKNOWN`. Asking for one pull request starts the work, so a short
 * retry usually settles it. Whatever is still unknown stays unknown.
 */
export async function settleMergeable<P extends PullRequest>(
  github: Pick<GitHubReader, 'mergeableOf'>,
  repo: string,
  pulls: readonly P[],
  wait: Sleep = sleep,
): Promise<P[]> {
  let settled = [...pulls];
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const pending = settled.filter((pull) => pull.mergeable === 'UNKNOWN');
    if (!pending.length) break;
    if (attempt > 0) await wait(RETRY_WAIT_MS);
    const answers = new Map<number, string>();
    for (const pull of pending) {
      try {
        answers.set(pull.number, await github.mergeableOf(repo, pull.number));
      } catch {
        // Left unknown: the counts say so honestly.
      }
    }
    settled = settled.map((pull) =>
      answers.has(pull.number) ? { ...pull, mergeable: answers.get(pull.number) as string } : pull,
    );
  }
  return settled;
}
