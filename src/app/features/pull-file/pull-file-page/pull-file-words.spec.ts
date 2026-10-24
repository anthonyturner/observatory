import { PullFile } from '../../../core/queue/pull-file';
import { changeLabel, fileMessage, stateMessage } from './pull-file-words';

const file = (extra: Partial<PullFile> = {}): PullFile => ({
  path: 'src/a.ts',
  sha: 'a'.repeat(40),
  headOid: 'a'.repeat(40),
  state: 'shown',
  text: '',
  bytes: 0,
  patch: '',
  githubUrl: 'https://github.com/me/app/blob/x/src/a.ts',
  ...extra,
});

describe('fileMessage', () => {
  it('has nothing to say of a file that is shown', () => {
    expect(fileMessage(file())).toBeNull();
  });

  it('gives the size of a file too large, and where to open it on GitHub', () => {
    expect(fileMessage(file({ state: 'too-large', bytes: 2_097_152 }))).toEqual({
      headline: 'This file is too large to show here (2048 KB).',
      link: { label: 'Open it on GitHub.', url: 'https://github.com/me/app/blob/x/src/a.ts' },
    });
  });

  it('sends a missing file to the pull request, which is what its address holds', () => {
    const message = fileMessage(
      file({ state: 'missing', githubUrl: 'https://github.com/me/app/pull/7' }),
    );

    expect(message?.headline).toBe('This file is not in the pull request at that commit.');
    expect(message?.link?.url).toBe('https://github.com/me/app/pull/7');
  });

  it('names the private note, as the diff does, and a binary file', () => {
    expect(fileMessage(file({ state: 'hidden' }))?.headline).toContain('is private');
    expect(fileMessage(file({ state: 'binary' }))?.headline).toContain('binary');
  });
});

describe('stateMessage', () => {
  it('speaks while reading and when the file cannot be read, and defers to the file once read', () => {
    expect(stateMessage({ status: 'reading' })?.headline).toBe('Opening the file…');
    expect(stateMessage({ status: 'unreachable' })?.headline).toBe('Could not read the file');
    expect(stateMessage({ status: 'ready', file: file() })).toBeNull();
    expect(stateMessage({ status: 'ready', file: file({ state: 'binary' }) })).not.toBeNull();
  });
});

describe('changeLabel', () => {
  it('counts the changes from one, or says there are none', () => {
    expect(changeLabel(1, 5)).toBe('Change 2 of 5');
    expect(changeLabel(0, 0)).toBe('No changes to show');
  });
});
