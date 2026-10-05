import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiHandler } from '../http/api-handler.ts';
import { guardLoopback } from '../http/loopback-guard.ts';
import { AGENT_SPEECH_PATH, JEV_HOLD_PATH, withAgentSpeechRoutes } from './agent-speech-routes.ts';
import type { AgentSpeech } from './agent-speech-state.ts';

const SPEAKING: AgentSpeech = { busy: true, speaking: true, paused: false, queued: false };
const LOCAL = 'http://127.0.0.1:4319';
const OWN_PAGE = { 'x-observatory': '1', host: '127.0.0.1:4319', origin: 'http://localhost:4200' };

function site() {
  const calls: string[] = [];
  const handle = guardLoopback(
    createApiHandler(
      withAgentSpeechRoutes(
        { get: {}, post: {} },
        {
          speech: { read: async () => SPEAKING },
          hold: {
            renew: (token) => void calls.push(`renew ${token}`),
            release: (token) => void calls.push(`release ${token}`),
          },
        },
      ),
    ),
  );
  const send = (path: string, init: RequestInit = {}) =>
    handle(new Request(`${LOCAL}${path}`, { ...init, headers: { ...OWN_PAGE, ...init.headers } }));
  const renew = (body: unknown) =>
    send(JEV_HOLD_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { handle, send, renew, calls };
}

describe('withAgentSpeechRoutes', () => {
  it('says what Agent Speak is doing', async () => {
    const { send } = site();

    const response = await send(AGENT_SPEECH_PATH);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), SPEAKING);
  });

  it('renews and releases a hold by its token', async () => {
    const { send, renew, calls } = site();

    assert.equal((await renew({ token: 'tab-1' })).status, 200);
    assert.equal((await send(`${JEV_HOLD_PATH}?token=tab-1`, { method: 'DELETE' })).status, 200);

    assert.deepEqual(calls, ['renew tab-1', 'release tab-1']);
  });

  it('refuses a token that would not fit on the marker’s one ASCII line', async () => {
    const { send, renew, calls } = site();

    for (const token of ['', 'a|b', 'line\nbreak', 'x'.repeat(65), 42]) {
      assert.equal((await renew({ token })).status, 400, String(token));
    }
    assert.equal((await send(JEV_HOLD_PATH, { method: 'DELETE' })).status, 400);
    assert.deepEqual(calls, []);
  });

  it('needs the x-observatory header for all three', async () => {
    const { handle, calls } = site();
    const bare = (path: string, method: string) =>
      handle(
        new Request(`${LOCAL}${path}`, {
          method,
          headers: {
            host: '127.0.0.1:4319',
            origin: 'http://localhost:4200',
            'content-type': 'application/json',
          },
          ...(method === 'POST' ? { body: '{"token":"tab-1"}' } : {}),
        }),
      );

    assert.equal((await bare(AGENT_SPEECH_PATH, 'GET')).status, 403);
    assert.equal((await bare(JEV_HOLD_PATH, 'POST')).status, 403);
    assert.equal((await bare(`${JEV_HOLD_PATH}?token=tab-1`, 'DELETE')).status, 403);
    assert.deepEqual(calls, []);
  });

  it('answers only this machine’s own page', async () => {
    const { send, calls } = site();

    const rebound = await send(AGENT_SPEECH_PATH, { headers: { host: 'rebound.example' } });
    const crossSite = await send(JEV_HOLD_PATH, {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: '{"token":"tab-1"}',
    });

    assert.equal(rebound.status, 403);
    assert.equal(crossSite.status, 403);
    assert.deepEqual(calls, []);
  });
});
