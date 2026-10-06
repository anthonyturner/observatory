import { crewKey, crewTargetOf } from './crew-tag';

describe('crewTargetOf', () => {
  it('reads the pull request from a crew prompt’s first line, as the API writes it', () => {
    expect(
      crewTargetOf('Observatory crew ship for me/app.js#42: fix-checks\n\nYou are a crew'),
    ).toEqual({ repo: 'me/app.js', number: 42 });
  });

  it('finds no crew in any other prompt, or a tag that is not on the first line', () => {
    expect(crewTargetOf('Tidy the README')).toBeNull();
    expect(crewTargetOf('Tidy it\nObservatory crew ship for me/app#42: fix-checks')).toBeNull();
    expect(crewTargetOf('Observatory crew ship for me/app#42x')).toBeNull();
  });
});

describe('crewKey', () => {
  it('is one key per pull request, whatever the case of its repository', () => {
    expect(crewKey('Me/App', 7)).toBe(crewKey('me/app', 7));
    expect(crewKey('me/app', 7)).not.toBe(crewKey('me/app', 8));
  });
});
