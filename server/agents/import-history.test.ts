import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import type { Handoff } from './agents-report.ts';
import { pastHandoffFiles, unrecorded } from './import-history.ts';

const handoff = (at: string, pr?: number): Handoff => ({
  at,
  kind: pr ? 'pr-opened' : 'agent-stop',
  session: 's1',
  agent: null,
  ...(pr ? { pr, url: `https://github.com/o/r/pull/${pr}` } : {}),
});

describe('unrecorded', () => {
  it('keeps only handoffs not yet recorded, each once, oldest first', () => {
    const existing = [handoff('2026-09-23T11:00:00Z', 6)];
    const incoming = [
      handoff('2026-09-24T09:00:00Z', 8),
      handoff('2026-09-23T11:00:00Z', 6),
      handoff('2026-09-23T12:00:00Z'),
      handoff('2026-09-24T09:00:00Z', 8),
    ];
    assert.deepEqual(
      unrecorded(existing, incoming).map((each) => [each.at, each.pr]),
      [
        ['2026-09-23T12:00:00Z', undefined],
        ['2026-09-24T09:00:00Z', 8],
      ],
    );
  });
});

describe('pastHandoffFiles', () => {
  it("finds pr-starmap's handoff file in each repository beside the root", () => {
    const root = mkdtempSync(join(tmpdir(), 'handoffs-'));
    for (const repo of ['one', 'two'])
      mkdirSync(join(root, repo, '.claude', 'queue'), { recursive: true });
    writeFileSync(join(root, 'one', '.claude', 'queue', 'handoffs.jsonl'), '');
    mkdirSync(join(root, 'three'));

    assert.deepEqual(pastHandoffFiles(root), [
      join(root, 'one', '.claude', 'queue', 'handoffs.jsonl'),
    ]);
  });
});
