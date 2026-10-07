import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  ReleaseTimeline,
  UNRELEASED_KEY,
  VersionBump,
} from '../../../core/releases/release-timeline';
import { BUMP_WORDS, dateWords, mergedWords } from '../release-words';

export interface ReleaseRow {
  readonly key: string;
  readonly title: string;
  readonly kind: string;
  readonly when: string;
  readonly count: string;
  /** Colours the row's dot as the sky colours its star; the comet's is its own. */
  readonly ink: VersionBump | 'comet';
}

/** The timeline as rows, newest first, the Unreleased work on top. */
export function releaseRows(timeline: ReleaseTimeline): ReleaseRow[] {
  const released = [...timeline.releases].reverse().map(({ release, bump }): ReleaseRow => ({
    key: release.tag,
    title: release.tag,
    kind: release.isPrerelease ? 'Prerelease' : BUMP_WORDS[bump],
    when: dateWords(release.publishedAt),
    count: mergedWords(release.pulls.length),
    ink: bump,
  }));
  const { unreleased } = timeline;
  if (!unreleased) return released;
  const unreleasedRow: ReleaseRow = {
    key: UNRELEASED_KEY,
    title: 'Unreleased',
    kind: 'Not in a release yet',
    when: '',
    count: mergedWords(unreleased.pulls.length),
    ink: 'comet',
  };
  return [unreleasedRow, ...released];
}

/** The same releases as the sky, as a list for the keyboard and a screen reader. */
@Component({
  selector: 'app-release-list',
  templateUrl: './release-list.html',
  styleUrl: './release-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReleaseList {
  readonly timeline = input.required<ReleaseTimeline>();
  readonly selected = input<string | null>(null);
  readonly picked = output<string>();

  protected readonly rows = computed(() => releaseRows(this.timeline()));
}
