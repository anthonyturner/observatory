import { VersionBump } from '../../../core/releases/release-timeline';
import { StarType } from '../../../shared/gl/star-shader';

/** A major release flares like a giant, a minor one burns clear, a patch rests. */
const TYPE_BY_BUMP: Readonly<Record<VersionBump, StarType>> = {
  major: 'giant',
  minor: 'bright',
  patch: 'calm',
  other: 'calm',
};

/** Which of the review queue's star types a release is drawn as; a prerelease is veiled. */
export function releaseStarType(release: {
  readonly bump: VersionBump;
  readonly isPrerelease: boolean;
}): StarType {
  return release.isPrerelease ? 'veiled' : TYPE_BY_BUMP[release.bump];
}
