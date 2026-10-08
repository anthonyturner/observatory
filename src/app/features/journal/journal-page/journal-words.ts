import { JournalState } from '../../../core/journal/journal-feed';
import { JournalReport } from '../../../core/journal/journal-report';
import { plural } from '../../../shared/text/plural';
import { PageMessage } from '../../releases/releases-page/releases-words';

/** What to say while there is no report to read, or none to show, or null once there are lessons. */
export function stateMessage(state: JournalState): PageMessage | null {
  switch (state.status) {
    case 'reading':
      return { headline: 'Opening the journal…' };
    case 'missing':
      return { headline: 'No such project', detail: 'It may be private, or the name is wrong.' };
    case 'unreachable':
      return {
        headline: 'Could not read the journal',
        detail: 'GitHub or the API did not answer. Try again in a moment.',
      };
    case 'ready':
      return state.report.entries.length
        ? null
        : {
            headline: 'No lessons recorded yet',
            detail:
              'A lesson appears here once a self-review on a pull request carries a “Second draft” section.',
          };
  }
}

/** "me/app · 3 lessons". */
export function journalStamp(repo: string, report: JournalReport | null): string {
  return report ? `${repo} · ${plural(report.entries.length, 'lesson')}` : repo;
}

/** The line above a filtered list: how many of the entries are showing. */
export function filterWords(shown: number, total: number, label: string): string {
  return `${shown} of ${total} taught “${label}”`;
}
