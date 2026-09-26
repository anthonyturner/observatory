import type { CloneFinder } from '../collisions/clone-finder.ts';

/** A folder a run may use: a project's local clone. */
export interface Checkout {
  readonly name: string;
  readonly repo: string;
  readonly folder: string;
}

/** The only authority on which folders a run may use. */
export interface CheckoutRegistry {
  list(): Promise<readonly Checkout[]>;
}

/** A project as the registry needs it. */
export interface ProjectRef {
  readonly name: string;
  readonly repo: string;
}

/** Each of `projects` that has a clone on this machine, read afresh on every call
 *  so a clone that has gone is no longer runnable. */
export function cloneCheckouts(
  projects: () => Promise<readonly ProjectRef[]>,
  clones: CloneFinder,
): CheckoutRegistry {
  return {
    async list() {
      const found = await Promise.all(
        (await projects()).map(async (project) => ({
          ...project,
          folder: await clones.cloneOf(project.repo),
        })),
      );
      return found.filter((checkout): checkout is Checkout => checkout.folder !== null);
    },
  };
}
