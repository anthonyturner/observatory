import { ReleasesState } from '../../../core/releases/releases-feed';
import { ReleasesReport } from '../../../core/releases/releases-report';
import { plural } from '../../../shared/text/plural';

/** A message in place of the timeline: a headline, and what to do about it. */
export interface PageMessage {
  readonly headline: string;
  readonly detail?: string;
}

/** What to say while there is no report to draw, or null once there is one. */
export function stateMessage(state: ReleasesState): PageMessage | null {
  switch (state.status) {
    case 'reading':
      return { headline: 'Reading the releases…' };
    case 'missing':
      return { headline: 'No such project', detail: 'It may be private, or the name is wrong.' };
    case 'unreachable':
      return {
        headline: 'Could not read the releases',
        detail: 'GitHub or the API did not answer. Try again in a moment.',
      };
    case 'ready':
      return null;
  }
}

/** "me/app · 12 releases", and where they came from when it was not releases. */
export function releasesStamp(repo: string, report: ReleasesReport | null): string {
  if (!report) return repo;
  switch (report.source) {
    case 'releases':
      return `${repo} · ${plural(report.releases.length, 'release')}`;
    case 'tags':
      return `${repo} · ${plural(report.releases.length, 'tag')}`;
    case 'none':
      return `${repo} · no releases yet`;
  }
}

/** One line under the title when the releases are not GitHub releases. */
export function releasesNote(report: ReleasesReport | null): string | null {
  switch (report?.source) {
    case 'none':
      return 'No releases yet: they appear here once one is cut.';
    case 'tags':
      return 'No GitHub releases, so each tag stands for one.';
    default:
      return null;
  }
}
