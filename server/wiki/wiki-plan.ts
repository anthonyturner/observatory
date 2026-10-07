import { isGenerated } from './wiki-render.ts';

/** The page GitHub opens a wiki on, and the one its owner saves to create the wiki. */
const HOME = 'Home';

/** What a sync does to the wiki, page name to content. */
export interface SyncPlan {
  readonly write: ReadonlyMap<string, string>;
  /** Pages the sync wrote before that it no longer publishes. */
  readonly remove: readonly string[];
  /** Hand-written pages left alone although the sync has a page of that name. */
  readonly kept: readonly string[];
}

/**
 * Plans a sync of the generated pages over the wiki's current pages. Only a
 * page the sync wrote is ever replaced or removed, with one exception: on the
 * first sync, the Home page the owner saved to create the wiki is taken over.
 */
export function planSync(
  current: ReadonlyMap<string, string>,
  generated: ReadonlyMap<string, string>,
): SyncPlan {
  const isFirstSync = ![...current.values()].some(isGenerated);
  const isOwned = (name: string): boolean => {
    const content = current.get(name);
    return content === undefined || isGenerated(content) || (isFirstSync && name === HOME);
  };
  const names = [...generated.keys()];
  return {
    write: new Map([...generated].filter(([name]) => isOwned(name))),
    remove: [...current]
      .filter(([name, content]) => isGenerated(content) && !generated.has(name))
      .map(([name]) => name),
    kept: names.filter((name) => !isOwned(name)),
  };
}
