import { LibraryState } from '../../../core/library/library-feed';
import { LibraryReport } from '../../../core/library/library-report';
import { plural } from '../../../shared/text/plural';

/** A message in place of the page: a headline, and what to do about it. */
export interface PageMessage {
  readonly headline: string;
  readonly detail?: string;
}

/** What to say while there is no report to read, or null once there is one. */
export function stateMessage(state: LibraryState): PageMessage | null {
  switch (state.status) {
    case 'reading':
      return { headline: 'Opening the library…' };
    case 'missing':
      return { headline: 'No such project', detail: 'It may be private, or the name is wrong.' };
    case 'unreachable':
      return {
        headline: 'Could not read the library',
        detail: 'GitHub or the API did not answer. Try again in a moment.',
      };
    case 'ready':
      return state.report.pages.length
        ? null
        : {
            headline: 'Nothing to read yet',
            detail: 'No public wiki, and no README or docs folder.',
          };
  }
}

/** "me/app · 12 pages". */
export function libraryStamp(repo: string, report: LibraryReport | null): string {
  return report ? `${repo} · ${plural(report.pages.length, 'page')}` : repo;
}

/** One line under the title saying where the pages came from. */
export function libraryNote(report: LibraryReport | null): string | null {
  switch (report?.source) {
    case 'wiki':
      return report.isTruncated
        ? 'From the wiki. Only the first pages linked from Home are shown.'
        : 'From the wiki, following its links from Home.';
    case 'docs':
      return report.isTruncated
        ? 'No public wiki, so this reads the README and the first files in docs.'
        : 'No public wiki, so this reads the README and docs.';
    default:
      return null;
  }
}
