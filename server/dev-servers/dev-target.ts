import type { DevServerStatus, DevTarget, StartPhase } from './dev-server-types.ts';

/** The one name two requests for the same target share, whatever the case of the repository. */
export const targetKey = (target: DevTarget): string =>
  target.pull === undefined
    ? target.repo.toLowerCase()
    : `${target.repo.toLowerCase()}#${target.pull}`;

export const stopped = (target: DevTarget): DevServerStatus => ({ ...target, state: 'stopped' });
export const unavailable = (target: DevTarget, reason: string): DevServerStatus => ({
  ...target,
  state: 'unavailable',
  reason,
});
export const failed = (target: DevTarget, reason: string): DevServerStatus => ({
  ...target,
  state: 'failed',
  reason,
});
export const starting = (target: DevTarget, phase: StartPhase): DevServerStatus => ({
  ...target,
  state: 'starting',
  phase,
});
