import { jevOffNote } from './jev-off-note';

describe('jevOffNote', () => {
  it('names a project in an example, and where the key goes on this machine', () => {
    expect(jevOffNote('local', 'observatory')).toBe(
      'Jev is off, so only app actions work: “open the orrery”, “refresh”, “issues for observatory”. ' +
        'Quick answers need an OpenRouter key: set `OPENROUTER_API_KEY` for the API, then restart it.',
    );
  });

  it('points the hosted site at the Vercel project, with no project to name', () => {
    const note = jevOffNote('hosted', null);

    expect(note).toContain('“open the orrery”, “refresh”.');
    expect(note).toContain('on the Vercel project');
  });
});
