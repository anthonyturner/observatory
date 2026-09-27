import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ToolArgError } from './tool-args.ts';
import { webSearchTool } from './web-search.ts';

const context = { projects: [] };

describe('web_search', () => {
  it('looks the query up, giving the model the answer and the reply the pages', async () => {
    const asked: string[] = [];
    const sources = [{ title: 'Notes', url: 'https://example.com/notes' }];
    const tool = webSearchTool(async (query) => {
      asked.push(query);
      return { text: 'Version 5 is out.', isCut: false, sources };
    });

    const result = await tool.run({ query: ' what is new in angular ' }, context);

    assert.deepEqual(asked, ['what is new in angular']);
    assert.deepEqual(result, {
      content: { answer: 'Version 5 is out.', sources: ['Notes'] },
      sources,
    });
  });

  it('refuses a search with no query', async () => {
    const tool = webSearchTool(async () => assert.fail('searched'));

    await assert.rejects(tool.run({}, context), ToolArgError);
  });
});
