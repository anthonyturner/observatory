import { jumpTargetOf } from './jump-target';

const HOME = 'http://localhost:4344/';

describe('jumpTargetOf', () => {
  it('goes to a page of the app, fragment and all', () => {
    expect(jumpTargetOf('/p/me/app#issues', HOME)).toEqual({
      kind: 'page',
      url: '/p/me/app#issues',
    });
  });

  it('stays put for the page already open', () => {
    expect(jumpTargetOf('/', HOME)).toEqual({ kind: 'here' });
  });

  it('leaves the app for another site', () => {
    expect(jumpTargetOf('https://example.com/x', HOME)).toEqual({
      kind: 'away',
      href: 'https://example.com/x',
    });
  });
});
