import { PullState } from '../../../core/activity/activity-lookups';
import { CrewMark } from '../../../core/crew/crew.types';
import { Satellite } from '../../../core/live-agents/satellites';
import { Fate, How } from '../../../core/queue/history-report';
import { ThreadCounts } from '../../../core/queue/pull-ending';
import { Meteor } from '../engine/meteor-layer';
import { SkyItem } from '../engine/sky-model';
import { IssuePlanet, issuePlanets } from '../engine/star-system';

/* What leaves the sky with a pull request. A departure is the one model every
   ending is drawn, sounded and spoken from: what the star carried while it was
   there, and what GitHub says became of the pull request. */

/** What orbits or visits a pull request's star, as the sky last drew it. */
export interface StarSystem {
  /** One per issue the pull request says it closes, up to four. */
  readonly planets: readonly IssuePlanet[];
  readonly crew: CrewMark | null;
  /** Live agents on its branch. */
  readonly satellites: readonly Satellite[];
  /** New commits since you looked: at most one per pull request. */
  readonly meteor: Meteor | null;
}

/** A star nobody saw carry anything: a pull request that left before this page was open. */
export const EMPTY_SYSTEM: StarSystem = {
  planets: [],
  crew: null,
  satellites: [],
  meteor: null,
};

/** How a pull request that left the queue ended. Each field is null when nothing has said. */
export interface Ending {
  readonly fate: Fate;
  readonly how: How | null;
  /** Its review threads, as GitHub counted them when it ended. */
  readonly threads: ThreadCounts | null;
  /** The issues it closed, which are the planets that resolve. */
  readonly closes: readonly number[] | null;
}

/** An ending known only by its fate and perhaps its way, as the history frames
 *  and the ledger record it. A closed pull request was closed, whatever else is known. */
export const endingOf = (fate: Fate, how: How | null = null): Ending => ({
  fate,
  how: fate === 'closed' ? 'closed' : how,
  threads: null,
  closes: null,
});

/** The ending in GitHub's answer, or null while the pull request is still open. */
export function endingOfPull(pull: PullState): Ending | null {
  if (pull.state === 'OPEN') return null;
  return {
    ...endingOf(pull.state === 'MERGED' ? 'merged' : 'closed', pull.ending?.how),
    threads: pull.ending?.threads ?? null,
    closes: pull.ending?.closes ?? null,
  };
}

/** Everything about a pull request's exit: what it carried, and how it ended
 *  (null when it left without anyone learning how). */
export interface Departure {
  readonly system: StarSystem;
  readonly ending: Ending | null;
}

/** What the sky holds for stars. */
export interface SystemSources {
  readonly items: readonly SkyItem[];
  readonly crews: readonly CrewMark[];
  readonly satellites: readonly Satellite[];
  readonly meteors: readonly Meteor[];
}

/** The system each pull request's star carries now, taken so that it can be
 *  remembered after the star has gone. */
export function systemsOf({
  items,
  crews,
  satellites,
  meteors,
}: SystemSources): Map<number, StarSystem> {
  return new Map(
    items.map((item) => [
      item.pr,
      {
        planets: issuePlanets({ item }),
        crew: crews.find((crew) => crew.pr === item.pr) ?? null,
        satellites: satellites.filter((satellite) => satellite.pr === item.pr),
        meteor: meteors.find((meteor) => meteor.pr === item.pr) ?? null,
      },
    ]),
  );
}
