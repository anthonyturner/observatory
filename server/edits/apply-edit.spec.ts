import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyEdit, firstLine } from './apply-edit.ts';
import type { EditChanges } from './edit-request.ts';
import { OPEN_DRAFT, fakeWriter } from './fake-writer.ts';

const request = (changes: EditChanges) => ({ repo: 'me/app', number: 7, changes });
const HEAD = OPEN_DRAFT.headRefOid;

describe('applyEdit', () => {
  it('sends the reversible changes in one edit, the title trimmed', async () => {
    const { writer, calls } = fakeWriter();
    const outcome = await applyEdit(request({ title: ' New ', addLabels: ['bug'] }), writer);

    assert.deepEqual(calls, [{ kind: 'edit', changes: { title: 'New', addLabels: ['bug'] } }]);
    assert.deepEqual(outcome, { status: 'applied', applied: ['title', 'addLabels'], errors: [] });
  });

  it('takes a draft out of draft, and calls one already ready done', async () => {
    const draft = fakeWriter();
    assert.equal((await applyEdit(request({ ready: true }), draft.writer)).status, 'applied');
    assert.deepEqual(draft.calls, [{ kind: 'ready' }]);

    const ready = fakeWriter({ ...OPEN_DRAFT, isDraft: false });
    const outcome = await applyEdit(request({ ready: true }), ready.writer);
    assert.deepEqual(ready.calls, []);
    assert.deepEqual(outcome.applied, ['ready (already ready)']);
  });

  it('merges only at the commit that was seen', async () => {
    const { writer, calls } = fakeWriter();
    const merge = { method: 'squash', headOid: HEAD } as const;
    assert.equal((await applyEdit(request({ merge }), writer)).status, 'applied');
    assert.deepEqual(calls, [{ kind: 'merge', merge }]);

    const moved = fakeWriter({ ...OPEN_DRAFT, headRefOid: 'b'.repeat(40) });
    const outcome = await applyEdit(request({ merge }), moved.writer);
    assert.deepEqual(moved.calls, []);
    assert.equal(outcome.status, 'failed');
    assert.match(outcome.errors[0], /you saw aaaaaaa, it is now bbbbbbb/);
  });

  it('refuses to merge a branch that conflicts', async () => {
    const { writer, calls } = fakeWriter({ ...OPEN_DRAFT, mergeable: 'CONFLICTING' });
    const outcome = await applyEdit(request({ merge: { method: 'merge', headOid: HEAD } }), writer);

    assert.deepEqual(calls, []);
    assert.deepEqual(outcome.errors, ['not merged: the branch conflicts with its base']);
  });

  it('skips a pull request that is no longer open', async () => {
    const { writer, calls } = fakeWriter({ ...OPEN_DRAFT, state: 'MERGED' });
    const outcome = await applyEdit(request({ title: 'x' }), writer);

    assert.deepEqual(calls, []);
    assert.deepEqual(outcome, {
      status: 'skipped',
      applied: [],
      errors: ['pull request is merged now'],
    });
  });

  it('fails when the pull request cannot be read', async () => {
    const { writer } = fakeWriter(new Error('HTTP 404\nbody'));
    const outcome = await applyEdit(request({ title: 'x' }), writer);

    assert.deepEqual(outcome, {
      status: 'failed',
      applied: [],
      errors: ['could not read the pull request: HTTP 404'],
    });
  });

  it('is partial when one step fails and another lands', async () => {
    const { writer } = fakeWriter(OPEN_DRAFT, ['ready']);
    const outcome = await applyEdit(request({ title: 'x', ready: true }), writer);

    assert.deepEqual(outcome, {
      status: 'partial',
      applied: ['title'],
      errors: ['ready failed: ready refused'],
    });
  });

  it('reports a failed edit by the first line gh wrote', async () => {
    const { writer } = fakeWriter(OPEN_DRAFT, ['edit']);
    const outcome = await applyEdit(request({ body: 'x' }), writer);

    assert.deepEqual(outcome, {
      status: 'failed',
      applied: [],
      errors: ['edit failed: edit refused'],
    });
  });
});

describe('firstLine', () => {
  it('prefers stderr, then the message, and keeps one line', () => {
    assert.equal(firstLine({ stderr: ' a\nb', message: 'm' }), 'a');
    assert.equal(firstLine(new Error('m\nn')), 'm');
    assert.equal(firstLine('plain'), 'plain');
  });
});
