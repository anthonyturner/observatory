import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ghGraphQl, graphQlArgs, graphQlData } from './gh-graphql.ts';

describe('graphQlArgs', () => {
  it('sends text raw, so a value is never read as a file, and a number typed', () => {
    assert.deepEqual(graphQlArgs('query { x }', { owner: '@me', first: 5, after: null }), [
      'api',
      'graphql',
      '-f',
      'query=query { x }',
      '-f',
      'owner=@me',
      '-F',
      'first=5',
    ]);
  });
});

describe('graphQlData', () => {
  it('answers the data, and refuses an answer with none', () => {
    assert.deepEqual(graphQlData({ data: { viewer: { login: 'me' } } }), {
      viewer: { login: 'me' },
    });
    assert.throws(() => graphQlData({ errors: [{ message: 'no' }] }), /no data/);
  });
});

describe('ghGraphQl', () => {
  it('asks gh with the query and the variables, and answers the data', async () => {
    const asked: (readonly string[])[] = [];
    const graphql = ghGraphQl(async (args) => {
      asked.push(args);
      return { data: { repository: { hasDiscussionsEnabled: true } } };
    });

    const data = await graphql('query($owner: String!) { x }', { owner: 'me' });

    assert.deepEqual(data, { repository: { hasDiscussionsEnabled: true } });
    assert.deepEqual(asked[0].slice(-2), ['-f', 'owner=me']);
  });
});
