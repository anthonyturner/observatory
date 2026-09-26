import { parseHistory } from './history-report';

describe('parseHistory', () => {
  it('keeps well-formed frames, oldest first', () => {
    const frames = parseHistory({
      repo: 'me/a',
      frames: [
        { at: '2026-09-25T00:00:00Z', items: [], departed: [] },
        {
          at: '2026-09-24T00:00:00Z',
          items: [{ number: 1, title: 'One', bucket: 'failing' }],
          departed: [{ number: 2, title: 'Two', fate: 'merged' }],
        },
      ],
    });

    expect(frames?.map((frame) => frame.at)).toEqual([
      '2026-09-24T00:00:00Z',
      '2026-09-25T00:00:00Z',
    ]);
    expect(frames?.[0].departed).toEqual([{ number: 2, title: 'Two', fate: 'merged' }]);
  });

  it('drops frames without a time, and items or departures it cannot read', () => {
    const frames = parseHistory({
      frames: [
        { at: 'yesterday', items: [] },
        {
          at: '2026-09-24T00:00:00Z',
          items: [
            { number: 1, bucket: 'fresh' },
            { number: 2, bucket: 'unknown' },
          ],
          departed: [{ number: 3, fate: 'vanished' }],
        },
      ],
    });

    expect(frames).toEqual([
      {
        at: '2026-09-24T00:00:00Z',
        items: [{ number: 2, title: '', bucket: 'unknown', idleDays: 0 }],
        departed: [],
      },
    ]);
  });

  it('refuses something that is not a history', () => {
    expect(parseHistory({ frames: 'none' })).toBeNull();
    expect(parseHistory(null)).toBeNull();
  });
});
