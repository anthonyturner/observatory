import { CoreStateId } from '../instrument/core-states';

export type CoreChipId = 'idle' | 'listening' | 'working' | 'speaking' | 'error';

/** One chip under the core, and the core states that light it. */
export interface CoreChip {
  readonly id: CoreChipId;
  readonly label: string;
  readonly states: readonly CoreStateId[];
}

export const IDLE_CHIP: CoreChip = { id: 'idle', label: 'Idle', states: ['idle'] };
export const WORKING_CHIP: CoreChip = {
  id: 'working',
  label: 'Working',
  states: ['routing', 'transcribing', 'running'],
};

/** The chips, in order. */
export const CORE_CHIPS: readonly CoreChip[] = [
  IDLE_CHIP,
  { id: 'listening', label: 'Listening', states: ['listening'] },
  WORKING_CHIP,
  { id: 'speaking', label: 'Speaking', states: ['speaking'] },
  { id: 'error', label: 'Error', states: ['error'] },
];

/** The chip `state` lights. A state no chip lists lights Idle: a reply that
 *  has landed is Home at rest. */
export function chipOf(state: CoreStateId): CoreChip {
  return CORE_CHIPS.find((chip) => chip.states.includes(state)) ?? IDLE_CHIP;
}
