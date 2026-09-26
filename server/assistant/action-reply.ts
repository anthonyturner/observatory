import { ACTIONS, type ActableId, type ProjectPart } from './actions.ts';
import type { ActionReply, AskReply, Project } from './route-contract.ts';

/** The most projects offered as buttons at once. */
export const MAX_ASK_PROJECTS = 6;

const NO_STAR_MAP = 'No project has a star map yet.';

/** The project a part goes to: the one named, else any one when the part is
 *  the same on each, else the only one there is. */
function projectFor(
  action: ProjectPart,
  project: Project | null,
  projects: readonly Project[],
): Project | null {
  if (project) return project;
  return action.needs === 'any' || projects.length === 1 ? (projects[0] ?? null) : null;
}

/** Which project, as buttons, when a part needs one and none was named. */
const whichProject = (id: ActableId, title: string, projects: readonly Project[]): AskReply => ({
  action: id,
  question: 'Which project?',
  ask: projects.slice(0, MAX_ASK_PROJECTS).map((each) => ({
    label: `${title} for ${each.name}`,
    pick: { action: id, project: each.name },
  })),
});

/** A tier-1 action, for the page to carry out: an op, a place to go, or which project. */
export function actionReply(
  id: ActableId,
  project: Project | null,
  projects: readonly Project[],
): ActionReply | AskReply {
  const action = ACTIONS[id];
  if ('op' in action) return { tier: 1, action: id, op: action.op };
  if ('href' in action) {
    return { tier: 1, action: id, href: action.href, says: `Opening ${action.title}` };
  }
  const at = projectFor(action, project, projects);
  if (at) {
    return {
      tier: 1,
      action: id,
      href: at.href + action.part,
      says: `Opening ${at.name} · ${action.title}`,
    };
  }
  if (!projects.length) return { tier: 1, action: id, text: NO_STAR_MAP };
  return whichProject(id, action.title, projects);
}
