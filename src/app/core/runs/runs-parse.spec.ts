import { readLines } from './ndjson-lines';
import { parseRunEvent, parseRunSummary, parseRunsReport } from './runs-parse';
import { summaryOf } from './testing/run-fixtures';

describe('parseRunSummary', () => {
  it('reads a run as the runner sends it', () => {
    const run = {
      ...summaryOf({ state: 'done', endedAt: 5, code: 0 }),
      result: { error: false, subtype: 'success', costUsd: 0.42, turns: 6, durationMs: 83000 },
      events: 17,
    };

    expect(parseRunSummary(run)).toEqual({
      ...summaryOf({ state: 'done', endedAt: 5, code: 0 }),
      result: run.result,
    });
  });

  it('is null for a run with no id, an unknown state or no start', () => {
    expect(parseRunSummary({ ...summaryOf(), id: '' })).toBeNull();
    expect(parseRunSummary({ ...summaryOf(), state: 'paused' })).toBeNull();
    expect(parseRunSummary({ ...summaryOf(), startedAt: 'today' })).toBeNull();
  });
});

describe('parseRunsReport', () => {
  it('reads the current run and the recent ones, leaving out any that are not one', () => {
    expect(parseRunsReport({ current: null, recent: [summaryOf(), { id: 7 }] })).toEqual({
      current: null,
      recent: [summaryOf()],
    });
    expect(parseRunsReport({ current: summaryOf() })).toBeNull();
  });
});

describe('parseRunEvent', () => {
  it('reads an event, keeping a kind it does not know', () => {
    expect(parseRunEvent('{"n":3,"at":9,"kind":"mystery","data":{"x":1}}')).toEqual({
      n: 3,
      at: 9,
      kind: 'mystery',
      data: { x: 1 },
    });
  });

  it('is null for a line that is not an event', () => {
    expect(parseRunEvent('{"n":3')).toBeNull();
    expect(parseRunEvent('{"n":"3","at":9,"kind":"state"}')).toBeNull();
    expect(parseRunEvent('[]')).toBeNull();
  });
});

describe('readLines', () => {
  it('gives each line as it completes, across chunks, and a last one with no newline', async () => {
    const encoder = new TextEncoder();
    const chunks = ['{"n":0}\n{"n', '":1}\n\n', '{"n":2}'];
    const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    const lines: string[] = [];

    await readLines(body, (line) => lines.push(line));

    expect(lines).toEqual(['{"n":0}', '{"n":1}', '{"n":2}']);
  });
});
