import { parseLedger } from './ledger';
import { StackPull, landedBaseOf, linksOf, stackLinks, stacksOf } from './stacks';

const pull = (number: number, base = 'main', branch = `feat/${number}`): StackPull => ({
  number,
  branch,
  base,
});

describe('stackLinks', () => {
  it('links a pull request to the open one whose head it merges into, down a chain', () => {
    const pulls = [pull(1), pull(2, 'feat/1'), pull(3, 'feat/2'), pull(4)];

    expect(stackLinks(pulls)).toEqual([
      { child: 2, parent: 1 },
      { child: 3, parent: 2 },
    ]);
  });

  it('links two pull requests stacked on one', () => {
    const pulls = [pull(1), pull(2, 'feat/1'), pull(3, 'feat/1')];

    expect(stackLinks(pulls)).toEqual([
      { child: 2, parent: 1 },
      { child: 3, parent: 1 },
    ]);
  });

  it('links nothing to a fork merging its own main, or to a head two pull requests share', () => {
    const fork = pull(9, 'main', 'main');
    const twins = [pull(5, 'main', 'fix'), pull(6, 'main', 'fix'), pull(7, 'fix')];

    expect(stackLinks([fork, pull(1), pull(2)])).toEqual([]);
    expect(stackLinks(twins)).toEqual([]);
  });

  it('never links a pull request to itself, nor one with no branches', () => {
    expect(stackLinks([pull(1, 'feat/1'), pull(2, '', '')])).toEqual([]);
  });
});

describe('landedBaseOf', () => {
  const merged = [{ number: 12, head: 'feat/12', base: 'main' }];

  it('names the merge of the base a pull request was stacked on', () => {
    expect(landedBaseOf(pull(13, 'feat/12'), [pull(13, 'feat/12')], merged)).toEqual({
      number: 12,
      branch: 'feat/12',
      into: 'main',
    });
  });

  it('says nothing while an open pull request still heads the base, or for main', () => {
    const reopened = [pull(20, 'main', 'feat/12'), pull(13, 'feat/12')];

    expect(landedBaseOf(pull(13, 'feat/12'), reopened, merged)).toBeNull();
    expect(landedBaseOf(pull(14), [pull(14)], merged)).toBeNull();
  });
});

describe('stacksOf', () => {
  it('notes each stacked pull request’s parent, children and merged base, and nothing else', () => {
    const pulls = [pull(1), pull(2, 'feat/1'), pull(3, 'feat/2'), pull(4), pull(5, 'feat/0')];
    const stacks = stacksOf(pulls, [{ number: 0, head: 'feat/0', base: 'main' }]);

    expect(stacks.get(1)).toEqual({ parent: null, children: [2], landed: null });
    expect(stacks.get(2)).toEqual({ parent: 1, children: [3], landed: null });
    expect(stacks.get(3)).toEqual({ parent: 2, children: [], landed: null });
    expect(stacks.get(5)?.landed).toEqual({ number: 0, branch: 'feat/0', into: 'main' });
    expect(stacks.has(4)).toBe(false);
    expect(linksOf(stacks)).toEqual([
      { child: 2, parent: 1 },
      { child: 3, parent: 2 },
    ]);
  });
});

describe('parseLedger’s merged branches', () => {
  it('keeps each well-formed merge and leaves out the rest', () => {
    const ledger = parseLedger({
      generatedAt: 'x',
      rows: [],
      titles: {},
      mergedBranches: [
        { number: 12, head: 'feat/12', base: 'main' },
        { number: 'x', head: 'a', base: 'main' },
        { number: 3, head: '', base: 'main' },
      ],
    });

    expect(ledger?.mergedBranches).toEqual([{ number: 12, head: 'feat/12', base: 'main' }]);
  });

  it('reads a ledger from before merges were listed as having none', () => {
    expect(parseLedger({ generatedAt: 'x', rows: [], titles: {} })?.mergedBranches).toEqual([]);
  });
});
