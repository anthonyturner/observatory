import { parseAgentFeed } from './agent-feed-parse';

describe('parseAgentFeed', () => {
  it('reads a page, and the null cursor of ids no transcript has', () => {
    expect(parseAgentFeed({ events: [{ type: 'user' }], next: 40, isRestart: false })).toEqual({
      events: [{ type: 'user' }],
      next: 40,
      isRestart: false,
    });
    expect(parseAgentFeed({ events: [], next: null, isRestart: true })?.next).toBeNull();
  });

  it('refuses anything else', () => {
    const bodies: unknown[] = [
      null,
      'page',
      { events: {}, next: 0, isRestart: false },
      { events: [], next: -1, isRestart: false },
      { events: [], next: 1.5, isRestart: false },
      { events: [], next: 0, isRestart: 'no' },
    ];

    for (const body of bodies) expect(parseAgentFeed(body)).toBeNull();
  });
});
