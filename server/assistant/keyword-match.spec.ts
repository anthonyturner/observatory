import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { keywordMatch, words } from './keyword-match.ts';
import type { Project } from './route-contract.ts';

const observatory: Project = {
  name: 'observatory',
  repo: 'me/observatory',
  href: '/p/me/observatory',
};
const logsApi: Project = { name: 'logs-api', repo: 'me/logs-api', href: '/p/me/logs-api' };
const projects = [observatory, logsApi];

describe('words', () => {
  it('lower-cases, drops possessives and splits on anything else', () => {
    assert.deepEqual(words("Observatory's Star-Map, NOW!"), ['observatory', 'star', 'map', 'now']);
  });
});

describe('keywordMatch', () => {
  it('matches a command wrapped in filler', () => {
    const match = keywordMatch('open the logs for observatory please', projects);

    assert.equal(match.action, 'show-logs');
    assert.equal(match.project, observatory);
  });

  it('leaves a question alone, although it uses a keyword', () => {
    const match = keywordMatch('how do I stop a rebase', projects);

    assert.equal(match.action, null);
    assert.deepEqual(match.actions, ['stop']);
  });

  it('reads a project called logs-api as a project, not as a request for logs', () => {
    const match = keywordMatch('open logs-api', projects);

    assert.equal(match.action, 'open-star-map');
    assert.equal(match.project, logsApi);
  });

  it('matches a project by its repository too', () => {
    assert.equal(keywordMatch('issues me/observatory', projects).project, observatory);
  });

  it('is no command when it names two actions', () => {
    const match = keywordMatch('issues and logs', projects);

    assert.equal(match.action, null);
    assert.deepEqual(match.actions, ['show-issues', 'show-logs']);
  });

  it('names no project when it names two', () => {
    const match = keywordMatch('issues for observatory and logs-api', projects);

    assert.equal(match.action, null);
    assert.equal(match.project, null);
  });

  it('matches what the speech model mishears', () => {
    assert.equal(keywordMatch('show the ory', projects).action, 'open-orrery');
  });
});
