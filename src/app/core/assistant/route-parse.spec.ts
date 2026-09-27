import { parseAssistantStatus, parseRouteReply } from './route-parse';

describe('parseAssistantStatus', () => {
  it('reads Jev, where the site runs, and the skills, leaving out any that are not one', () => {
    expect(
      parseAssistantStatus({
        jev: 'off',
        where: 'hosted',
        skills: [
          { id: 'stale', label: 'Find stale PRs', description: 'Idle a week', project: null },
          { id: 'notes', label: 'Draft notes', description: '', project: 'observatory' },
          { id: 'broken' },
          'nonsense',
        ],
      }),
    ).toEqual({
      jev: 'off',
      where: 'hosted',
      skills: [
        { id: 'stale', label: 'Find stale PRs', description: 'Idle a week' },
        { id: 'notes', label: 'Draft notes', project: 'observatory' },
      ],
    });
  });

  it('is null for anything else', () => {
    expect(parseAssistantStatus(null)).toBeNull();
    expect(parseAssistantStatus({ jev: 'maybe', where: 'local', skills: [] })).toBeNull();
    expect(parseAssistantStatus({ jev: 'on', where: 'local' })).toBeNull();
  });
});

describe('parseRouteReply', () => {
  it('reads a tier-1 action', () => {
    expect(
      parseRouteReply({
        via: 'keyword',
        tier: 1,
        action: 'show-issues',
        href: '/p/me/app#issues',
        says: 'Opening app · Issues',
        jev: 'on',
      }),
    ).toEqual(
      expect.objectContaining({
        via: 'keyword',
        tier: 1,
        action: 'show-issues',
        href: '/p/me/app#issues',
        says: 'Opening app · Issues',
        jev: 'on',
        ask: [],
        commands: [],
        sources: [],
      }),
    );
  });

  it('keeps each option with the pick it came with, and drops a malformed one', () => {
    const reply = parseRouteReply({
      question: 'Which project?',
      ask: [
        { label: 'Issues for app', pick: { action: 'show-issues', project: 'app' } },
        { label: 'No pick' },
        { label: 'Bad pick', pick: { project: { nested: true } } },
      ],
    });

    expect(reply?.ask).toEqual([
      { label: 'Issues for app', pick: { action: 'show-issues', project: 'app' } },
    ]);
  });

  it('reads a proposal’s commands, or its lone command when there is no list', () => {
    const powershell = { shell: 'PowerShell', command: 'claude -p (x)' };
    const bash = { shell: 'bash', command: 'claude -p [x]' };

    expect(parseRouteReply({ tier: 3, commands: [powershell, bash] })?.commands).toEqual([
      powershell,
      bash,
    ]);
    expect(parseRouteReply({ tier: 3, command: 'claude -p x' })?.commands).toEqual([
      { shell: null, command: 'claude -p x' },
    ]);
  });

  it('reads the local runner’s ticket whole, or not at all', () => {
    const run = {
      token: 't0k',
      folder: 'E:\\repos\\app',
      name: 'app',
      expiresAt: 1_000,
      limitMs: 1_800_000,
      command: 'claude -p --output-format stream-json --verbose',
    };

    expect(parseRouteReply({ tier: 3, prompt: 'fix it', run })?.run).toEqual(run);
    expect(parseRouteReply({ tier: 3, run: { ...run, expiresAt: 'soon' } })?.run).toBeUndefined();
    expect(parseRouteReply({ tier: 3, run: { ...run, token: '' } })?.run).toBeUndefined();
  });

  it('drops a field of the wrong kind rather than trusting it', () => {
    const reply = parseRouteReply({ tier: 4, via: 'jev', href: 42 });

    expect(reply?.tier).toBeUndefined();
    expect(reply?.via).toBeUndefined();
    expect(reply?.href).toBeUndefined();
  });

  it('reads Jev’s words on an action and on a proposal', () => {
    expect(parseRouteReply({ via: 'agent', tier: 1, says: 'Here it is.' })).toEqual(
      expect.objectContaining({ via: 'agent', says: 'Here it is.' }),
    );
    expect(parseRouteReply({ via: 'agent', tier: 3, text: 'Press Run.' })?.text).toBe('Press Run.');
  });

  it('passes the sources an answer drew on through, dropping a malformed one', () => {
    const source = { title: 'Git', url: 'https://git-scm.com' };

    expect(parseRouteReply({ tier: 2, sources: [source, { title: 'No url' }] })?.sources).toEqual([
      source,
    ]);
    expect(parseRouteReply({ tier: 2 })?.sources).toEqual([]);
  });

  it('is null for a body that is not an object', () => {
    expect(parseRouteReply('nope')).toBeNull();
    expect(parseRouteReply([])).toBeNull();
  });
});
