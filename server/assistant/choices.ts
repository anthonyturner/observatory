import { ACTIONS, type ActableId } from './actions.ts';
import type { Choice, Project } from './route-contract.ts';

/** How a button names an action, for `project` when one is known. */
export function actionLabel(id: ActableId, project: Project | null): string {
  const action = ACTIONS[id];
  if ('op' in action) return action.says;
  if (!('needs' in action) || action.needs !== 'project') return `Open ${action.title}`;
  return project ? `Open ${project.name} · ${action.title}` : `Open a project’s ${action.title}`;
}

export const actionChoice = (id: ActableId, project: Project | null): Choice => ({
  label: actionLabel(id, project),
  pick: { action: id, project: project?.name ?? null },
});

export const taskChoice = (project: Project | null): Choice => ({
  label: 'Run it as a Claude Code task',
  pick: { tier: 3, project: project?.name ?? null },
});
