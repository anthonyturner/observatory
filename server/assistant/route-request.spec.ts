import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequest } from '../http/api-handler.ts';
import { routeRequestFrom } from './route-request.ts';

const refuses = (body: unknown, message: RegExp) =>
  assert.throws(
    () => routeRequestFrom(body),
    (error: Error) => error instanceof BadRequest && message.test(error.message),
  );

describe('routeRequestFrom', () => {
  it('reads typed words, trimmed, and a pick', () => {
    assert.deepEqual(routeRequestFrom({ text: '  hi  ', pick: { tier: 3, project: 'app' } }), {
      skill: null,
      text: 'hi',
      pick: { tier: 3, project: 'app' },
      history: [],
    });
  });

  it('reads the conversation so far, each turn trimmed, empty ones dropped', () => {
    const history = [
      { role: 'user', text: '  hi ' },
      { role: 'assistant', text: 'Hello.' },
      { role: 'user', text: '   ' },
    ];

    assert.deepEqual(routeRequestFrom({ text: 'and you?', history }), {
      skill: null,
      text: 'and you?',
      pick: null,
      history: [
        { role: 'user', text: 'hi' },
        { role: 'assistant', text: 'Hello.' },
      ],
    });
  });

  it('refuses a conversation that is not one, too long, or too wordy', () => {
    const turn = { role: 'user', text: 'x' };
    refuses({ text: 'x', history: 'hi' }, /not a list/);
    refuses({ text: 'x', history: Array(13).fill(turn) }, /more than 12 turns/);
    refuses({ text: 'x', history: [{ role: 'system', text: 'x' }] }, /no such role/);
    refuses({ text: 'x', history: [{ role: 'user' }] }, /no text/);
    refuses({ text: 'x', history: [null] }, /not a turn/);
    refuses({ text: 'x', history: [{ role: 'user', text: 'x'.repeat(2001) }] }, /longer than 2000/);
  });

  it('reads a skill with no words', () => {
    assert.deepEqual(routeRequestFrom({ skill: 'stale' }), { skill: 'stale', pick: null });
  });

  it('refuses nothing to route, and too much', () => {
    refuses({ text: '   ' }, /nothing to route/);
    refuses({ text: 'x'.repeat(2001) }, /longer than 2000 characters/);
    refuses([], /body must be an object/);
  });

  it('refuses a pick that is not one', () => {
    refuses({ text: 'x', pick: { action: 'explode' } }, /no such action/);
    refuses({ text: 'x', pick: { action: 'none' } }, /no such action/);
    refuses({ text: 'x', pick: { tier: 1 } }, /bad pick/);
    refuses({ text: 'x', pick: { tier: 2 } }, /bad pick/);
    refuses({ text: 'x', pick: { tier: 3, project: 7 } }, /no such project/);
    refuses({ skill: 7 }, /no such skill/);
  });
});
