import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { MAX_SKILLS_BYTES, fileSkills, readSkillsFile, warnOnce } from './skills-file.ts';

const folder = mkdtempSync(join(tmpdir(), 'observatory-skills-'));
const fileWith = (name: string, text: string): string => {
  const file = join(folder, name);
  writeFileSync(file, text);
  return file;
};

const collect = () => {
  const lines: string[] = [];
  return { lines, warn: (line: string) => void lines.push(line) };
};

describe('readSkillsFile', () => {
  it('reads none, quietly, when there is no file', () => {
    const { lines, warn } = collect();

    assert.deepEqual(readSkillsFile(join(folder, 'missing.json'), warn), {});
    assert.deepEqual(lines, []);
  });

  it('refuses a file over the limit before reading it', () => {
    const { lines, warn } = collect();
    const file = fileWith('big.json', ' '.repeat(MAX_SKILLS_BYTES + 1));

    assert.deepEqual(readSkillsFile(file, warn), {});
    assert.match(lines[0], /over the 64 KiB limit/);
  });

  it('says so when the file is not JSON', () => {
    const { lines, warn } = collect();

    assert.deepEqual(readSkillsFile(fileWith('bad.json', '{'), warn), {});
    assert.match(lines[0], /not JSON/);
  });
});

describe('fileSkills', () => {
  it('reads the file afresh on each call', async () => {
    const file = fileWith('skills.json', '{}');
    const skills = fileSkills(file, collect().warn);
    assert.equal((await skills())['mine'], undefined);

    writeFileSync(file, JSON.stringify({ mine: { label: 'Mine', prompt: 'Do mine.' } }));

    assert.equal((await skills())['mine'].label, 'Mine');
  });
});

describe('warnOnce', () => {
  it('passes each distinct line on once', () => {
    const { lines, warn } = collect();
    const once = warnOnce(warn);

    once('a');
    once('a');
    once('b');

    assert.deepEqual(lines, ['a', 'b']);
  });
});
