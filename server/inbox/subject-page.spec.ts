import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { subjectPageOf } from './subject-page.ts';

const API = 'https://api.github.com/repos';

describe('subjectPageOf', () => {
  it('turns a pull request’s API URL into its page, with its number', () => {
    assert.deepEqual(subjectPageOf('me/app', 'PullRequest', `${API}/me/app/pulls/7`), {
      url: 'https://github.com/me/app/pull/7',
      number: 7,
    });
  });

  it('turns an issue’s, a commit’s and a discussion’s API URL into their pages', () => {
    assert.deepEqual(subjectPageOf('me/app', 'Issue', `${API}/me/app/issues/12`), {
      url: 'https://github.com/me/app/issues/12',
      number: 12,
    });
    assert.deepEqual(subjectPageOf('me/app', 'Commit', `${API}/me/app/commits/abc123`), {
      url: 'https://github.com/me/app/commit/abc123',
      number: null,
    });
    assert.deepEqual(subjectPageOf('me/app', 'Discussion', `${API}/me/app/discussions/3`), {
      url: 'https://github.com/me/app/discussions/3',
      number: null,
    });
  });

  it('opens the repository’s list for a CI run or a release, which have no page by id', () => {
    assert.equal(
      subjectPageOf('me/app', 'CheckSuite', null).url,
      'https://github.com/me/app/actions',
    );
    assert.equal(
      subjectPageOf('me/app', 'Release', `${API}/me/app/releases/991`).url,
      'https://github.com/me/app/releases',
    );
  });

  it('opens the repository for anything it does not know, or a URL off GitHub’s API', () => {
    assert.equal(subjectPageOf('me/app', 'Something', null).url, 'https://github.com/me/app');
    assert.deepEqual(
      subjectPageOf('me/app', 'PullRequest', 'https://evil.example/repos/me/app/pulls/7'),
      { url: 'https://github.com/me/app', number: null },
    );
    assert.equal(
      subjectPageOf('me/app', 'PullRequest', `${API}/me/app/pulls/7?x=<script>`).url,
      'https://github.com/me/app',
    );
  });
});
