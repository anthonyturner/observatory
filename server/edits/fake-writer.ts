import type { LivePull, MergeRequest, PullChanges, PullWriter } from '../github/pull-writer.ts';

/** What a test's writer was asked to do, in order. */
export type WriterCall =
  | { readonly kind: 'edit'; readonly changes: PullChanges }
  | { readonly kind: 'ready' }
  | { readonly kind: 'merge'; readonly merge: MergeRequest };

export const OPEN_DRAFT: LivePull = {
  state: 'OPEN',
  isDraft: true,
  headRefOid: 'a'.repeat(40),
  mergeable: 'MERGEABLE',
};

/** A writer that changes nothing on GitHub: it records each call, and fails the kinds named. */
export function fakeWriter(
  live: LivePull | Error = OPEN_DRAFT,
  failing: readonly WriterCall['kind'][] = [],
): { writer: PullWriter; calls: WriterCall[] } {
  const calls: WriterCall[] = [];
  const record = async (call: WriterCall): Promise<void> => {
    calls.push(call);
    if (failing.includes(call.kind)) {
      throw Object.assign(new Error('x'), { stderr: `${call.kind} refused\nmore` });
    }
  };
  return {
    calls,
    writer: {
      livePull: async () => {
        if (live instanceof Error) throw live;
        return live;
      },
      editPull: (_repo, _number, changes) => record({ kind: 'edit', changes }),
      markReady: () => record({ kind: 'ready' }),
      mergePull: (_repo, _number, merge) => record({ kind: 'merge', merge }),
    },
  };
}
