import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ChatRequest } from './chat-messages.ts';
import { OpenRouterError } from './open-router-error.ts';
import { openRouter } from './open-router.ts';

const KEY = 'sk-or-v1-test-key';

interface Sent {
  readonly url: string;
  readonly init: RequestInit;
}

/** A fetch that answers each call with the next response, remembering what was sent. */
function fakeFetch(...responses: (() => Response)[]) {
  const sent: Sent[] = [];
  const send = async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    return next();
  };
  return { sent, fetch: send as typeof fetch };
}

const failing = (error: Error) =>
  (async () => {
    throw error;
  }) as typeof fetch;

const noSleep = async () => undefined;

const ASK: ChatRequest = {
  messages: [{ role: 'user', content: 'hi' }],
  tools: [],
  toolChoice: 'auto',
};

const chatWith = (send: typeof fetch) =>
  openRouter({ key: KEY, fetch: send, sleep: noSleep }).chat(ASK);

const said = (content: string) => () =>
  Response.json({ choices: [{ message: { content }, finish_reason: 'stop' }] });

const hasReason = (reason: string) => (error: OpenRouterError) => error.reason === reason;

describe('openRouter', () => {
  it('asks the chat model with the key, the model and the length cap, as Observatory', async () => {
    const { sent, fetch } = fakeFetch(said('Hello.'));

    const turn = await chatWith(fetch);

    assert.deepEqual(turn, { text: 'Hello.', toolCalls: [], isCut: false });
    assert.equal(sent[0].url, 'https://openrouter.ai/api/v1/chat/completions');
    const headers = new Headers(sent[0].init.headers);
    assert.equal(headers.get('authorization'), `Bearer ${KEY}`);
    assert.equal(headers.get('x-title'), 'Observatory');
    const body = JSON.parse(String(sent[0].init.body));
    assert.equal(body.model, 'anthropic/claude-haiku-4.5');
    assert.equal(body.max_tokens, 800);
    assert.equal(body.tool_choice, 'auto');
  });

  it('sends tools and tool turns in the OpenAI shape, and reads tool calls back', async () => {
    const call = { id: 'c1', type: 'function', function: { name: 'refresh', arguments: '{}' } };
    const { sent, fetch } = fakeFetch(() =>
      Response.json({ choices: [{ message: { content: null, tool_calls: [call] } }] }),
    );
    const models = openRouter({ key: KEY, fetch });

    const turn = await models.chat({
      messages: [
        { role: 'assistant', content: null, toolCalls: [{ id: 'c0', name: 'x', arguments: '{}' }] },
        { role: 'tool', toolCallId: 'c0', content: '{"ok":true}' },
      ],
      tools: [{ name: 'refresh', description: 'Refresh.', parameters: { type: 'object' } }],
      toolChoice: 'none',
    });

    assert.deepEqual(turn.toolCalls, [{ id: 'c1', name: 'refresh', arguments: '{}' }]);
    const body = JSON.parse(String(sent[0].init.body));
    assert.deepEqual(body.messages[0].tool_calls[0], {
      id: 'c0',
      type: 'function',
      function: { name: 'x', arguments: '{}' },
    });
    assert.deepEqual(body.messages[1], {
      role: 'tool',
      tool_call_id: 'c0',
      content: '{"ok":true}',
    });
    assert.deepEqual(body.tools[0], {
      type: 'function',
      function: { name: 'refresh', description: 'Refresh.', parameters: { type: 'object' } },
    });
    assert.equal(body.tool_choice, 'none');
  });

  it('trims the words, and says when they were cut off', async () => {
    const { fetch } = fakeFetch(() =>
      Response.json({
        choices: [{ message: { content: '  Use git rebase.  ' }, finish_reason: 'length' }],
      }),
    );

    assert.deepEqual(await chatWith(fetch), {
      text: 'Use git rebase.',
      toolCalls: [],
      isCut: true,
    });
  });

  it('is off with no key, and fails every call with the reason key, sending nothing', async () => {
    const { sent, fetch } = fakeFetch();
    const models = openRouter({ key: null, fetch });

    assert.equal(models.isOn, false);
    await assert.rejects(models.chat(ASK), hasReason('key'));
    assert.equal(sent.length, 0);
  });

  it('tries a rate limit twice more, waiting at most a second and a half each time', async () => {
    const waits: number[] = [];
    const busy = () => new Response('', { status: 429, headers: { 'retry-after': '30' } });
    const { sent, fetch } = fakeFetch(busy, busy, said('Hi.'));

    const models = openRouter({ key: KEY, fetch, sleep: async (ms) => void waits.push(ms) });

    assert.equal((await models.chat(ASK)).text, 'Hi.');
    assert.equal(sent.length, 3);
    assert.deepEqual(waits, [1500, 1500]);
  });

  it('gives up after two retries with the reason busy', async () => {
    const busy = () => new Response('', { status: 429 });
    const { fetch } = fakeFetch(busy, busy, busy);

    await assert.rejects(chatWith(fetch), hasReason('busy'));
  });

  it('names the reason from the status, and never echoes the key', async () => {
    const said = { error: { message: `Invalid key ${KEY}, header Bearer ${KEY}` } };
    const { fetch } = fakeFetch(() => Response.json(said, { status: 401 }));

    await assert.rejects(chatWith(fetch), (error: OpenRouterError) => {
      assert.equal(error.reason, 'key');
      assert.equal(error.words, 'the key was refused');
      assert.equal(error.status, 401);
      assert.ok(!error.message.includes(KEY), error.message);
      assert.match(error.message, /\[key\]/);
      return true;
    });
  });

  it('scrubs a network failure that carries the key', async () => {
    const fetch = failing(new Error(`connect failed for Bearer ${KEY}`));

    await assert.rejects(chatWith(fetch), (error: OpenRouterError) => {
      assert.equal(error.reason, 'network');
      assert.ok(!error.message.includes(KEY), error.message);
      return true;
    });
  });

  it('reads a timeout as one', async () => {
    await assert.rejects(
      chatWith(failing(new DOMException('timed out', 'TimeoutError'))),
      hasReason('timeout'),
    );
  });

  it('refuses an answer it cannot read', async () => {
    const { fetch } = fakeFetch(() => Response.json({ nothing: true }));

    await assert.rejects(chatWith(fetch), hasReason('shape'));
  });
});
