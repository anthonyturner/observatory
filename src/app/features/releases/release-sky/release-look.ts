import { VersionBump } from '../../../core/releases/release-timeline';
import { StarType } from '../../../shared/gl/star-shader';

/** How a release's star is drawn: the review queue's star types, chosen by what the release was. */
export interface ReleaseLook {
  readonly type: StarType;
  /** The CSS colour token, without `--`. */
  readonly token: string;
}

/** A major release flares like a giant, a minor one burns clear, a patch rests; a prerelease is veiled. */
const TYPE_BY_BUMP: Readonly<Record<VersionBump, StarType>> = {
  major: 'giant',
  minor: 'bright',
  patch: 'calm',
  other: 'calm',
};

export function releaseLook(release: {
  readonly bump: VersionBump;
  readonly isPrerelease: boolean;
}): ReleaseLook {
  return {
    type: release.isPrerelease ? 'veiled' : TYPE_BY_BUMP[release.bump],
    token: `release-${release.bump}`,
  };
}
