import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { isInside, transcriptOf } from './transcript-files.ts';

const SESSION = '11111111-1111-4111-8111-111111111111';
const root = mkdtempSync(join(tmpdir(), 'transcript-files-'));
after(() => rmSync(root, { recursive: true, force: true }));

describe('transcriptOf', () => {
  it('finds a session or subagent transcript in whichever project folder holds it', async () => {
    const logsDir = join(root, 'logs');
    const subagents = join(logsDir, 'e--repos-b', SESSION, 'subagents');
    mkdirSync(join(logsDir, 'e--repos-a'), { recursive: true });
    mkdirSync(subagents, { recursive: true });
    writeFileSync(join(logsDir, 'e--repos-b', `${SESSION}.jsonl`), '{}\n');
    writeFileSync(join(subagents, 'agent-ab12.jsonl'), '{}\n');

    const session = await transcriptOf(logsDir, { session: SESSION, agentId: null });
    const subagent = await transcriptOf(logsDir, { session: SESSION, agentId: 'ab12' });
    const missing = await transcriptOf(logsDir, { session: SESSION, agentId: 'cd34' });

    assert.equal(session?.file, join(logsDir, 'e--repos-b', `${SESSION}.jsonl`));
    assert.equal(subagent?.file, join(subagents, 'agent-ab12.jsonl'));
    assert.equal(missing, null);
  });

  it('reads nothing outside the logs folder, whatever the ids', async () => {
    const logsDir = join(root, 'guarded');
    mkdirSync(join(logsDir, 'p'), { recursive: true });
    writeFileSync(join(root, 'outside.jsonl'), '{}\n');

    const found = await transcriptOf(logsDir, { session: '../../outside', agentId: null });

    assert.equal(found, null);
    assert.equal(isInside(logsDir, join(logsDir, 'p', 'x.jsonl')), true);
    assert.equal(isInside(logsDir, join(root, 'outside.jsonl')), false);
    assert.equal(isInside(logsDir, logsDir), false);
  });
});
