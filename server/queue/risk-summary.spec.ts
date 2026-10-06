import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ChatRequest, ChatTurn } from '../assistant/chat-messages.ts';
import { OpenRouterError } from '../assistant/open-router-error.ts';
import { type SummaryInput, oneLineOf, riskSummaries, summaryRequest } from './risk-summary.ts';

const HEAD = 'a'.repeat(40);

const pull = (overrides: Partial<SummaryInput> = {}): SummaryInput => ({
  number: 58,
  title: 'Replace the facade',
  body: 'Closes #57. Moves the reads behind one service.',
  headOid: HEAD,
  changedFiles: 2,
  additions: 30,
  deletions: 12,
  files: [
    { path: 'src/app/facade.ts', additions: 20, deletions: 10 },
    { path: 'src/app/reads.ts', additions: 10, deletions: 2 },
  ],
  ...overrides,
});

const turn = (text: string): ChatTurn => ({ text, toolCalls: [], isCut: false });

/** A model that answers `text` and counts what it was asked. */
function fakeModel(answer: () => Promise<ChatTurn>) {
  const asked: ChatRequest[] = [];
  return {
    asked,
    model: {
      isOn: true,
      chat: (request: ChatRequest) => {
        asked.push(request);
        return answer();
      },
    },
  };
}

const quiet = () => undefined;

describe('summaryRequest', () => {
  it('asks for one line from the title, description and files, with no tools', () => {
    const request = summaryRequest(pull());

    assert.deepEqual(request.tools, []);
    assert.equal(request.messages[0].role, 'system');
    const user = String(request.messages[1].content);
    assert.match(user, /Replace the facade/);
    assert.match(user, /Moves the reads behind one service/);
    assert.match(user, /src\/app\/facade\.ts \(\+20 −10\)/);
  });

  it('cuts a long description and a long file list, and says how many were left out', () => {
    const files = Array.from({ length: 60 }, (_, n) => ({
      path: `f${n}.ts`,
      additions: 1,
      deletions: 0,
    }));
    const user = String(
      summaryRequest(pull({ body: 'x'.repeat(5000), files, changedFiles: 75 })).messages[1].content,
    );

    assert.ok(user.length < 4000);
    assert.match(user, /f39\.ts/);
    assert.doesNotMatch(user, /f40\.ts/);
    assert.match(user, /and 35 more files/);
  });
});

describe('oneLineOf', () => {
  it('keeps the first line, without quotes, markdown or a label', () => {
    assert.equal(
      oneLineOf('**Summary:** "Moves reads behind a service."\n\nMore.'),
      'Moves reads behind a service.',
    );
    assert.equal(oneLineOf('- Adds a risk tag.'), 'Adds a risk tag.');
  });

  it('cuts a line that runs on, and gives nothing for no words', () => {
    assert.equal(oneLineOf('word '.repeat(80))?.endsWith('…'), true);
    assert.ok((oneLineOf('word '.repeat(80)) ?? '').length <= 200);
    assert.equal(oneLineOf('  \n '), null);
  });
});

describe('riskSummaries', () => {
  it('asks the model once per head commit', async () => {
    const { asked, model } = fakeModel(async () => turn('Moves reads behind a service.'));
    const summaries = riskSummaries(model, quiet);

    assert.equal(await summaries.summaryOf('me/a', pull()), 'Moves reads behind a service.');
    assert.equal(await summaries.summaryOf('me/a', pull()), 'Moves reads behind a service.');
    assert.equal(asked.length, 1);

    await summaries.summaryOf('me/a', pull({ headOid: 'b'.repeat(40) }));
    await summaries.summaryOf('me/b', pull());
    assert.equal(asked.length, 3);
  });

  it('shares one question between callers who ask at once', async () => {
    const { asked, model } = fakeModel(async () => turn('One line.'));
    const summaries = riskSummaries(model, quiet);

    await Promise.all([summaries.summaryOf('me/a', pull()), summaries.summaryOf('me/a', pull())]);
    assert.equal(asked.length, 1);
  });

  it('gives no summary when the model fails, logs why, and asks again next time', async () => {
    let fails = true;
    const { asked, model } = fakeModel(async () => {
      if (fails) throw new OpenRouterError('busy', 429);
      return turn('Second try.');
    });
    const logged: string[] = [];
    const summaries = riskSummaries(model, (line) => logged.push(line));

    assert.equal(await summaries.summaryOf('me/a', pull()), null);
    assert.match(logged[0], /me\/a#58.*rate limited/);
    fails = false;
    assert.equal(await summaries.summaryOf('me/a', pull()), 'Second try.');
    assert.equal(asked.length, 2);
  });

  it('is off, and asks nothing, with no key', async () => {
    const { asked, model } = fakeModel(async () => turn('Never.'));
    const summaries = riskSummaries({ ...model, isOn: false }, quiet);

    assert.equal(summaries.isOn, false);
    assert.equal(await summaries.summaryOf('me/a', pull()), null);
    assert.equal(asked.length, 0);
  });
});
