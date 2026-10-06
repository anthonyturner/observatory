import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type LineSink, ndjsonResponse } from './ndjson-response.ts';

describe('ndjsonResponse', () => {
  it('sends each line as it comes, and ends at null', async () => {
    let sink: LineSink = () => undefined;
    const response = ndjsonResponse((given) => {
      sink = given;
      given('{"n":0}');
      return () => undefined;
    });

    sink('{"n":1}');
    sink(null);
    sink('{"n":2}');

    assert.equal(response.headers.get('content-type'), 'application/x-ndjson; charset=utf-8');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await response.text(), '{"n":0}\n{"n":1}\n');
  });

  it('stops its source when the reader goes away', async () => {
    let stopped = false;
    const response = ndjsonResponse((sink) => {
      sink('{"n":0}');
      return () => {
        stopped = true;
      };
    });
    const reader = response.body?.getReader();

    await reader?.read();
    await reader?.cancel();

    assert.equal(stopped, true);
  });
});
