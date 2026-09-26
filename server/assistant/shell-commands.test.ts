import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { commandFor, commandsFor, localShells } from './shell-commands.ts';

describe('commandFor', () => {
  it('double-quotes plain text for bash', () => {
    assert.equal(commandFor('list my PRs', 'bash'), 'claude -p "list my PRs"');
  });

  it('single-quotes text bash would expand, escaping each quote mark', () => {
    assert.equal(
      commandFor("echo $HOME, it's here", 'bash'),
      "claude -p 'echo $HOME, it'\\''s here'",
    );
  });

  it('always single-quotes for PowerShell, doubling every kind of single quote', () => {
    assert.equal(commandFor('it’s $x and "y"', 'powershell'), `claude -p 'it’’s $x and "y"'`);
    assert.equal(commandFor("don't", 'powershell'), "claude -p 'don''t'");
  });

  it('flattens lines, and keeps a leading dash from reading as an option', () => {
    assert.equal(commandFor('  -one\n   two  ', 'bash'), 'claude -p " -one two"');
  });
});

describe('commandsFor', () => {
  it('writes one command per shell, labelled', () => {
    assert.deepEqual(commandsFor('hi', ['powershell', 'bash']), [
      { shell: 'PowerShell', command: "claude -p 'hi'" },
      { shell: 'bash', command: 'claude -p "hi"' },
    ]);
  });

  it('picks the shell for this platform', () => {
    assert.deepEqual(localShells('win32'), ['powershell']);
    assert.deepEqual(localShells('linux'), ['bash']);
  });
});
