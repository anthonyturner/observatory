import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type CheckRerunner, rerunFailedJobsPath } from './check-rerunner.ts';
import { gh, ghJson } from './gh-cli.ts';
import { type InboxMarker, NOTIFICATIONS_PATH, threadPath } from './inbox-marker.ts';
import type { LivePull, PullChanges, PullWriter } from './pull-writer.ts';

const LIST_FLAGS: readonly (readonly [keyof PullChanges, string])[] = [
  ['addLabels', '--add-label'],
  ['removeLabels', '--remove-label'],
  ['addAssignees', '--add-assignee'],
  ['removeAssignees', '--remove-assignee'],
  ['addReviewers', '--add-reviewer'],
  ['removeReviewers', '--remove-reviewer'],
];

/** `gh pr edit`'s flags for everything but the body. */
export function editFlagsOf(changes: PullChanges): string[] {
  const flags: string[] = changes.title === undefined ? [] : ['--title', changes.title];
  for (const [key, flag] of LIST_FLAGS) {
    const list = changes[key];
    if (Array.isArray(list) && list.length) flags.push(flag, list.join(','));
  }
  return flags;
}

/** Runs `use` with a file holding `body`: a body can be tens of kilobytes and
 *  contain anything, and neither survives being an argument. */
async function withBodyFile(body: string, use: (file: string) => Promise<void>): Promise<void> {
  const scratch = mkdtempSync(join(tmpdir(), 'observatory-body-'));
  try {
    const file = join(scratch, 'body.md');
    writeFileSync(file, body, 'utf8');
    await use(file);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** Changes pull requests through the `gh` CLI, as the account this machine signed it in with. */
export function ghCliWriter(): PullWriter {
  return {
    livePull: (repo, number) =>
      ghJson<LivePull>([
        'pr',
        'view',
        String(number),
        '--repo',
        repo,
        '--json',
        'state,isDraft,headRefOid,mergeable',
      ]),
    async editPull(repo, number, changes) {
      const edit = (extra: readonly string[]) => {
        const flags = [...editFlagsOf(changes), ...extra];
        return flags.length
          ? gh(['pr', 'edit', String(number), '--repo', repo, ...flags]).then(() => undefined)
          : Promise.resolve();
      };
      if (changes.body === undefined) return edit([]);
      return withBodyFile(changes.body, (file) => edit(['--body-file', file]));
    },
    markReady: async (repo, number) => {
      await gh(['pr', 'ready', String(number), '--repo', repo]);
    },
    mergePull: async (repo, number, { method, headOid }) => {
      await gh([
        'pr',
        'merge',
        String(number),
        '--repo',
        repo,
        `--${method}`,
        '--match-head-commit',
        headOid,
      ]);
    },
  };
}

/** Reruns failed GitHub Actions jobs through the `gh` CLI, as this machine's account. */
export function ghCliRerunner(): CheckRerunner {
  return {
    rerunFailedJobs: async (repo, runId) => {
      await gh(['api', '--method', 'POST', rerunFailedJobsPath(repo, runId)]);
    },
  };
}

/** Marks notifications read through the `gh` CLI, as this machine's account. */
export function ghCliInboxMarker(): InboxMarker {
  return {
    markThreadRead: async (threadId) => {
      await gh(['api', '--method', 'PATCH', threadPath(threadId)]);
    },
    markAllRead: async (lastReadAt) => {
      await gh([
        'api',
        '--method',
        'PUT',
        NOTIFICATIONS_PATH,
        '-f',
        `last_read_at=${lastReadAt}`,
        '-F',
        'read=true',
      ]);
    },
  };
}
