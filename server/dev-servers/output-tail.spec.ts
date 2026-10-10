import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OutputTail } from './output-tail.ts';

describe('OutputTail', () => {
  it('has nothing to say before the server prints', () => {
    assert.equal(new OutputTail().lastLine(), '');
  });

  it('gives the last line that has something on it', () => {
    const tail = new OutputTail();

    tail.add('> app@0.0.0 start\n> ng serve\n\n   \n');

    assert.equal(tail.lastLine(), '> ng serve');
  });

  it('includes a question still waiting for its answer, which has no newline after it', () => {
    const tail = new OutputTail();

    tail.add('Port 4200 is already in use.\n');
    tail.add(Buffer.from('\u001B[1G\u001B[0K? Would you like to use a different port? (Y/n) '));

    assert.equal(tail.lastLine(), '? Would you like to use a different port? (Y/n)');
  });

  it('reads a progress line redrawn with carriage returns as its latest version', () => {
    const tail = new OutputTail();

    tail.add('building 10%\rbuilding 60%\r');

    assert.equal(tail.lastLine(), 'building 60%');
  });

  it('keeps only the end of a long output, and cuts a very long line short', () => {
    const tail = new OutputTail();
    tail.add(`first\n${'x'.repeat(10_000)}`);
    tail.add('\nlast words');
    assert.equal(tail.lastLine(), 'last words');

    tail.add(`\n${'y'.repeat(1_000)}`);
    assert.equal(tail.lastLine(), 'y'.repeat(200));
  });
});
