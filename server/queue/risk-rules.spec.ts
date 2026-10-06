import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type RiskChange, type RiskFile, riskOf } from './risk-rules.ts';

const file = (path: string, additions = 5, deletions = 1): RiskFile => ({
  path,
  additions,
  deletions,
});

/** A change of `files`, with the totals they add up to. */
const change = (...files: RiskFile[]): RiskChange => ({
  files,
  changedFiles: files.length,
  additions: files.reduce((sum, each) => sum + each.additions, 0),
  deletions: files.reduce((sum, each) => sum + each.deletions, 0),
});

describe('riskOf', () => {
  it('rates a small change to ordinary code low, with no reasons', () => {
    assert.deepEqual(riskOf(change(file('src/app/home/home.ts'), file('src/app/home/home.html'))), {
      level: 'low',
      reasons: [],
    });
  });

  it('rates auth and migrations high', () => {
    assert.deepEqual(riskOf(change(file('server/hosted/github-sign-in.ts'))), {
      level: 'high',
      reasons: ['auth'],
    });
    assert.deepEqual(riskOf(change(file('src/auth/session.ts'))).level, 'high');
    assert.deepEqual(riskOf(change(file('db/migrations/0042_add_users.sql'))), {
      level: 'high',
      reasons: ['migrations'],
    });
    assert.deepEqual(riskOf(change(file('prisma/schema.prisma'))).reasons, ['migrations']);
  });

  it('rates config, CI and dependencies medium', () => {
    assert.deepEqual(riskOf(change(file('tsconfig.json'))), {
      level: 'medium',
      reasons: ['config'],
    });
    assert.deepEqual(riskOf(change(file('.github/workflows/ci.yml'))), {
      level: 'medium',
      reasons: ['CI'],
    });
    assert.deepEqual(riskOf(change(file('package.json'), file('package-lock.json'))), {
      level: 'medium',
      reasons: ['dependencies'],
    });
    assert.deepEqual(riskOf(change(file('.env.example'))).reasons, ['config']);
    assert.deepEqual(riskOf(change(file('vite.config.ts'))).reasons, ['config']);
  });

  it('rates a change high when several medium reasons pile up', () => {
    const rating = riskOf(
      change(file('package.json'), file('angular.json'), file('.github/workflows/ci.yml')),
    );
    assert.deepEqual(rating, { level: 'high', reasons: ['config', 'CI', 'dependencies'] });
  });

  it('calls a change broad by its file count, its size or how many areas it spans', () => {
    const many = Array.from({ length: 30 }, (_, n) => file(`src/app/part-${n}.ts`));
    assert.deepEqual(riskOf(change(...many)), { level: 'medium', reasons: ['broad'] });

    assert.deepEqual(riskOf(change(file('src/app/big.ts', 900, 400))).reasons, ['broad']);

    const spread = ['src', 'server', 'docs', 'api', 'scripts'].map((top) => file(`${top}/x.ts`));
    assert.deepEqual(riskOf(change(...spread)).reasons, ['broad']);
  });

  it('counts the files GitHub left off the list toward breadth', () => {
    const listed = change(file('src/app/a.ts'));
    assert.deepEqual(riskOf({ ...listed, changedFiles: 140 }).reasons, ['broad']);
  });

  it('does not count tests or docs as risky, whatever they are named', () => {
    assert.deepEqual(
      riskOf(
        change(
          file('server/hosted/github-sign-in.test.ts'),
          file('src/app/auth/login.spec.ts'),
          file('docs/auth/setup.md'),
        ),
      ),
      { level: 'low', reasons: [] },
    );
  });

  it('does not mistake a word inside a name for an auth file', () => {
    assert.deepEqual(riskOf(change(file('src/app/author-list.ts'))).reasons, []);
    assert.deepEqual(riskOf(change(file('src/app/configurator/panel.ts'))).reasons, []);
  });

  it('reads Windows-style paths and upper case alike', () => {
    assert.deepEqual(riskOf(change(file('SRC\\Auth\\Guard.ts'))).reasons, ['auth']);
  });
});
