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
  /** The checkout of one project, `owner/name` in any case; null when this machine has none. */
  find(repo: string): Promise<Checkout | null>;
}

/** A project as the registry needs it. */
export interface ProjectRef {
  readonly name: string;
  readonly repo: string;
}

/** The registry over `projects` and their clones, read afresh on every call so a
 *  clone that has gone is no longer runnable. */
export function cloneCheckouts(
  projects: () => Promise<readonly ProjectRef[]>,
  clones: CloneFinder,
): CheckoutRegistry {
  const checkoutOf = async (project: ProjectRef): Promise<Checkout | null> => {
    const folder = await clones.cloneOf(project.repo);
    return folder === null ? null : { ...project, folder };
  };
  return {
    async list() {
      const found = await Promise.all((await projects()).map(checkoutOf));
      return found.filter((checkout) => checkout !== null);
    },
    async find(repo) {
      const wanted = repo.toLowerCase();
      const project = (await projects()).find((each) => each.repo.toLowerCase() === wanted);
      return project ? checkoutOf(project) : null;
    },
  };
}
