import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { upstashStore } from './upstash-store.ts';

const URL_BASE = 'https://kv.example';

/** A fake Upstash REST endpoint over a Map, recording each call. */
function fakeUpstash(token: string) {
  const data = new Map<string, string>();
  const calls: { url: string; auth: string | null; args: string[] }[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const args = JSON.parse(String(init?.body)) as string[];
    const auth = new Headers(init?.headers).get('authorization');
    calls.push({ url: String(input), auth, args });
    if (auth !== `Bearer ${token}`)
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    const [name, key, value] = args;
    if (name === 'GET') return Response.json({ result: data.get(key) ?? null });
    if (name === 'SET') {
      data.set(key, value);
      return Response.json({ result: 'OK' });
    }
    return Response.json({ error: `ERR unknown command ${name}` });
  };
  return { data, calls, fetch };
}

describe('upstashStore', () => {
  it('sets and gets JSON under a prefixed key, with the token', async () => {
    const upstash = fakeUpstash('secret');
    const store = upstashStore({ url: `${URL_BASE}/`, token: 'secret', fetch: upstash.fetch });

    await store.set('triage/me__app', { a: [1, 2] });

    assert.deepEqual(await store.get('triage/me__app'), { a: [1, 2] });
    assert.equal(upstash.data.get('obs:triage/me__app'), '{"a":[1,2]}');
    assert.equal(upstash.calls[0].url, URL_BASE);
    assert.equal(upstash.calls[0].auth, 'Bearer secret');
  });

  it('reads a missing key as null', async () => {
    const store = upstashStore({ url: URL_BASE, token: 't', fetch: fakeUpstash('t').fetch });

    assert.equal(await store.get('none/here'), null);
  });

  it('fails loudly on an HTTP error or a Redis error', async () => {
    const wrong = upstashStore({
      url: URL_BASE,
      token: 'wrong',
      fetch: fakeUpstash('right').fetch,
    });
    await assert.rejects(wrong.get('a/b'), /HTTP 401/);

    const erroring = upstashStore({
      url: URL_BASE,
      token: 't',
      fetch: async () => Response.json({ error: 'WRONGTYPE' }),
    });
    await assert.rejects(erroring.get('a/b'), /Redis: WRONGTYPE/);
  });

  it('needs its address and token', () => {
    assert.throws(() => upstashStore({ url: '', token: 't' }), /KV_REST_API_URL/);
    assert.throws(() => upstashStore({ url: URL_BASE, token: '' }), /KV_REST_API_TOKEN/);
  });

  it('refuses a key outside the store', async () => {
    const store = upstashStore({ url: URL_BASE, token: 't', fetch: fakeUpstash('t').fetch });

    await assert.rejects(store.get('../x'), /not a store key/);
  });
});
