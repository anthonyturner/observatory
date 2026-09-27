import { jevOffNote } from './jev-off-note';

describe('jevOffNote', () => {
  it('names a project in an example, and where the key goes on this machine', () => {
    expect(jevOffNote('local', 'observatory')).toBe(
      'Jev is off, so only app actions work: “open the orrery”, “refresh”, “issues for observatory”. ' +
        'Talking with Jev needs an OpenRouter key: set `OPENROUTER_API_KEY`, or put it in `~/.claude/observatory/.env`, then restart the site.',
    );
  });

  it('points the hosted site at the Vercel project, with no project to name', () => {
    const note = jevOffNote('hosted', null);

    expect(note).toContain('“open the orrery”, “refresh”.');
    expect(note).toContain('on the Vercel project');
  });
});
