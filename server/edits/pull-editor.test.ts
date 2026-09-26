import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EditTarget } from './edit-request.ts';
import type { EditRecord, EditStore } from './edit-store.ts';
import { type WriterCall, fakeWriter } from './fake-writer.ts';
import { pullEditor } from './pull-editor.ts';

function memoryEdits(): EditStore {
  const records = new Map<string, EditRecord | null>();
  const key = ({ repo, number }: EditTarget) => `${repo}#${number}`;
  return {
    read: async (target) => records.get(key(target)) ?? null,
    write: async (target, record) => void records.set(key(target), record),
  };
}

function editorWith(failing: readonly WriterCall['kind'][] = []) {
  const { writer, calls } = fakeWriter(undefined, failing);
  const changed: EditTarget[] = [];
  const editor = pullEditor({
    writer,
    labels: async () => [{ name: 'bug', color: 'd73a4a' }],
    store: memoryEdits(),
    changed: (target) => changed.push({ repo: target.repo, number: target.number }),
    now: () => Date.parse('2026-09-26T10:00:00Z'),
  });
  return { editor, calls, changed };
}

const target = { repo: 'me/app', number: 7 };

describe('pullEditor', () => {
  it('applies an edit, records how it went, and has the pull request read again', async () => {
    const { editor, calls, changed } = editorWith();
    const record = await editor.apply({ ...target, changes: { addLabels: ['bug'] } });

    assert.equal(calls.length, 1);
    assert.deepEqual(changed, [target]);
    assert.deepEqual(record, {
      pr: 7,
      status: 'applied',
      changes: { addLabels: ['bug'] },
      requestedAt: '2026-09-26T10:00:00.000Z',
      applied: ['addLabels'],
      message: 'applied: addLabels',
      appliedAt: '2026-09-26T10:00:00.000Z',
    });
    assert.deepEqual(await editor.read(target), record);
  });

  it('rejects an edit the rules refuse, without touching GitHub', async () => {
    const { editor, calls, changed } = editorWith();
    const record = await editor.apply({ ...target, changes: { addLabels: ['nope'] } });

    assert.deepEqual([calls, changed], [[], []]);
    assert.equal(record.status, 'rejected');
    assert.equal(record.message, 'label "nope" does not exist in this repository');
  });

  it('says what failed', async () => {
    const { editor, changed } = editorWith(['edit']);
    const record = await editor.apply({ ...target, changes: { title: 'T' } });

    assert.deepEqual([record.status, record.message], ['failed', 'edit failed: edit refused']);
    assert.deepEqual(changed, []);
  });

  it('clears a record', async () => {
    const { editor } = editorWith();
    await editor.apply({ ...target, changes: { title: 'T' } });
    await editor.clear(target);

    assert.equal(await editor.read(target), null);
  });
});
