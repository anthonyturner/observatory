/** Where one Rerun press stands. */
export type RerunState =
  | { readonly status: 'idle' }
  | { readonly status: 'sending' }
  | { readonly status: 'sent'; readonly runs: number }
  | { readonly status: 'refused'; readonly reason: string };

export const RERUN_IDLE: RerunState = { status: 'idle' };

export interface RerunView {
  readonly label: string;
  readonly hint: string;
  readonly isDisabled: boolean;
  readonly status: { readonly text: string; readonly tone: 'ok' | 'bad' } | null;
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

function statusOf(state: RerunState): RerunView['status'] {
  if (state.status === 'sent') {
    return {
      text: `Rerun started: ${plural(state.runs, 'workflow run')}. The star moves once its checks pass.`,
      tone: 'ok',
    };
  }
  if (state.status === 'refused') return { text: `Couldn’t rerun: ${state.reason}.`, tone: 'bad' };
  return null;
}

/** The Rerun button, its hint naming the flaky checks, and how the last press went. */
export function rerunViewOf(state: RerunState, flakyChecks: readonly string[]): RerunView {
  const names = [...new Set(flakyChecks)].join(', ');
  return {
    label: state.status === 'sending' ? 'Rerunning…' : 'Rerun',
    hint: `Only flaky checks failed: ${names}. Runs their failed jobs again on GitHub.`,
    isDisabled: state.status === 'sending' || state.status === 'sent',
    status: statusOf(state),
  };
}
