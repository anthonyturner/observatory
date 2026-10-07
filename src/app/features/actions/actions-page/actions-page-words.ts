import { ActionsState } from '../../../core/actions/actions-feed';
import { ActionsReport } from '../../../core/actions/actions-report';
import { plural } from '../../../shared/text/plural';
import { PageMessage } from '../../releases/releases-page/releases-words';

/** What to say while there is no report to draw, or null once there is one. */
export function stateMessage(state: ActionsState): PageMessage | null {
  switch (state.status) {
    case 'reading':
      return { headline: 'Reading the workflow runs…' };
    case 'missing':
      return { headline: 'No such project', detail: 'It may be private, or the name is wrong.' };
    case 'unreachable':
      return {
        headline: 'Could not read the workflow runs',
        detail: 'GitHub or the API did not answer. Try again in a moment.',
      };
    case 'ready':
      return null;
  }
}

/** What to say over a sky with nothing in it, or null when it shows runs. */
export function emptyMessage(report: ActionsReport, shown: number): PageMessage | null {
  if (!report.runs.length) {
    return {
      headline: 'No workflow runs yet',
      detail: 'Runs appear here once GitHub Actions runs one.',
    };
  }
  return shown ? null : { headline: 'No runs match', detail: 'Clear a filter to see more.' };
}

/** "me/app · 24 of 100 runs". */
export function actionsStamp(repo: string, report: ActionsReport | null, shown: number): string {
  if (!report) return repo;
  const total = report.runs.length;
  return shown === total
    ? `${repo} · ${plural(total, 'run')}`
    : `${repo} · ${shown} of ${plural(total, 'run')}`;
}
