import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scanSource } from './source-scan.ts';

const locOf = (text: string): number => scanSource('a.ts', text).loc;

describe('lines of code', () => {
  it('counts lines with code, not blank lines or comments', () => {
    assert.equal(
      locOf(`
        // a line comment

        /**
         * A doc comment.
         */
        export const one = 1; // trailing comment still has code

        /* block */
        export function two(): number {
          return 2;
        }
      `),
      4,
    );
  });

  it('counts every line of a template literal that spans lines', () => {
    assert.equal(locOf('export const text = `one\n\ntwo`;'), 3);
  });

  it('counts nothing for an empty file', () => {
    assert.equal(locOf(''), 0);
  });
});
