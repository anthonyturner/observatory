import type { ToolArgs, ToolContext } from '../agent/agent-tool.ts';
import type { Project } from '../route-contract.ts';

/** Arguments the model got wrong: it reads the message and can try again. */
export class ToolArgError extends Error {
  override readonly name = 'ToolArgError';
}

/** The text argument `name`, trimmed, or null when it was left out or empty. */
export function optionalText(args: ToolArgs, name: string): string | null {
  const value = args[name];
  if (value == null) return null;
  if (typeof value !== 'string') throw new ToolArgError(`${name} must be text`);
  return value.trim() || null;
}

export function requiredText(args: ToolArgs, name: string): string {
  const value = optionalText(args, name);
  if (value === null) throw new ToolArgError(`${name} is required`);
  return value;
}

const knownNames = (projects: readonly Project[]): string =>
  projects.map((each) => each.name).join(', ') || 'none';

/** The project `name` names, by name or repository, or null when it names none. */
export function optionalProject(
  args: ToolArgs,
  name: string,
  context: ToolContext,
): Project | null {
  const wanted = optionalText(args, name);
  if (wanted === null) return null;
  const named = wanted.toLowerCase();
  const project = context.projects.find(
    (each) => each.name.toLowerCase() === named || each.repo.toLowerCase() === named,
  );
  if (!project) {
    throw new ToolArgError(`No project called ${wanted}. Known: ${knownNames(context.projects)}`);
  }
  return project;
}

export function requiredProject(args: ToolArgs, name: string, context: ToolContext): Project {
  const project = optionalProject(args, name, context);
  if (!project)
    throw new ToolArgError(`${name} is required: one of ${knownNames(context.projects)}`);
  return project;
}

/** Keeps a title short enough to be cheap to send back. */
export const clipped = (text: string, most: number): string =>
  text.length > most ? `${text.slice(0, most - 1)}…` : text;
