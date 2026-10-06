import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_SKILLS, SKILLS, skillTable } from './skills-table.ts';

const collect = () => {
  const lines: string[] = [];
  return { lines, warn: (line: string) => void lines.push(line) };
};

describe('skillTable', () => {
  it('replaces a starter in place, removes one with null and adds new ones after', () => {
    const { lines, warn } = collect();

    const table = skillTable(
      {
        stale: { label: 'Old PRs', prompt: 'Find old PRs.', project: ' observatory ' },
        failures: null,
        deploy: { label: ' Check deploys ', description: 'Deploys.', prompt: 'Check.' },
      },
      warn,
    );

    assert.deepEqual(Object.keys(table), ['queue', 'blocked', 'stale', 'deploy']);
    assert.deepEqual(
      { ...table['stale'] },
      { label: 'Old PRs', description: '', prompt: 'Find old PRs.', project: 'observatory' },
    );
    assert.equal(table['deploy'].label, 'Check deploys');
    assert.deepEqual(lines, []);
  });

  it('leaves out a bad id or an entry that is not a skill, and says which', () => {
    const { lines, warn } = collect();

    const table = skillTable(
      { 'Bad Id': { label: 'x', prompt: 'y' }, nolabel: { prompt: 'y' } },
      warn,
    );

    assert.deepEqual(Object.keys(table), Object.keys(SKILLS));
    assert.match(lines[0], /left out Bad Id, nolabel/);
  });

  it('cuts a long description rather than losing it', () => {
    const table = skillTable(
      { long: { label: 'L', prompt: 'p', description: 'd'.repeat(200) } },
      collect().warn,
    );

    assert.equal(table['long'].description.length, 160);
    assert.ok(table['long'].description.endsWith('…'));
  });

  it(`stops at ${MAX_SKILLS} skills in all`, () => {
    const { lines, warn } = collect();
    const many = Object.fromEntries(
      Array.from({ length: MAX_SKILLS }, (_, i) => [`extra-${i}`, { label: 'x', prompt: 'y' }]),
    );

    const table = skillTable(many, warn);

    assert.equal(Object.keys(table).length, MAX_SKILLS);
    assert.match(lines[0], /at most 24 skills/);
  });

  it('keeps the starters when the file is not an object of skills', () => {
    const { lines, warn } = collect();

    assert.deepEqual(Object.keys(skillTable([], warn)), Object.keys(SKILLS));
    assert.match(lines[0], /expected an object/);
  });

  it('has no prototype, so no id reaches an inherited property', () => {
    assert.equal(skillTable({}, collect().warn)['constructor'], undefined);
  });
});
