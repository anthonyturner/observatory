import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { githubGraphQl } from './github-graphql.ts';

const answering = (status: number, body: unknown) => async () =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('githubGraphQl', () => {
  it('sends the query with the token and answers its data', async () => {
    let sent: RequestInit | undefined;
    const graphql = githubGraphQl({
      token: 'test-token',
      fetch: async (_url, init) => {
        sent = init;
        return Response.json({ data: { viewer: { login: 'me' } } });
      },
    });

    assert.deepEqual(await graphql('query { viewer { login } }', { a: 1 }), {
      viewer: { login: 'me' },
    });
    const headers = new Headers(sent?.headers);
    assert.equal(headers.get('authorization'), 'Bearer test-token');
    assert.ok(headers.get('user-agent'));
    assert.deepEqual(JSON.parse(String(sent?.body)), {
      query: 'query { viewer { login } }',
      variables: { a: 1 },
    });
  });

  it('fails with the status and message on an HTTP error', async () => {
    const graphql = githubGraphQl({
      token: 't',
      fetch: answering(401, { message: 'Bad credentials' }),
    });

    await assert.rejects(graphql('query { x }'), /GitHub: HTTP 401 Bad credentials/);
  });

  it('fails on GraphQL errors, even beside partial data', async () => {
    const graphql = githubGraphQl({
      token: 't',
      fetch: answering(200, {
        data: { repository: null },
        errors: [{ message: 'Could not resolve to a Repository' }],
      }),
    });

    await assert.rejects(graphql('query { x }'), /Could not resolve to a Repository/);
  });

  it('answers the rest when only a check run’s workflow is refused', async () => {
    const data = { repository: { run: { checkSuite: { workflowRun: null } } } };
    const graphql = githubGraphQl({
      token: 't',
      fetch: answering(200, {
        data,
        errors: [
          {
            type: 'FORBIDDEN',
            path: ['repository', 'run', 'checkSuite', 'workflowRun'],
            message: 'Resource not accessible by personal access token',
          },
        ],
      }),
    });

    assert.deepEqual(await graphql('query { x }'), data);
  });

  it('still fails when anything else is refused, naming where', async () => {
    const graphql = githubGraphQl({
      token: 't',
      fetch: answering(200, {
        data: { repository: null },
        errors: [
          { type: 'FORBIDDEN', path: ['repository', 'run', 'checkSuite', 'workflowRun'] },
          { type: 'FORBIDDEN', path: ['repository'], message: 'Resource not accessible' },
        ],
      }),
    });

    await assert.rejects(graphql('query { x }'), /Resource not accessible \(at repository\)/);
  });

  it('fails on an answer with no data, or one that is not JSON', async () => {
    await assert.rejects(
      githubGraphQl({ token: 't', fetch: answering(200, {}) })('query { x }'),
      /no data/,
    );
    await assert.rejects(
      githubGraphQl({ token: 't', fetch: answering(502, 'Bad gateway') })('query { x }'),
      /HTTP 502 Bad gateway/,
    );
  });

  it('needs a token', () => {
    assert.throws(() => githubGraphQl({ token: '' }), /GITHUB_TOKEN/);
  });
});
