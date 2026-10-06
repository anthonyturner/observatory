import { summaryOf } from '../runs/testing/run-fixtures';
import {
  CrewContext,
  CrewRun,
  crewFor,
  crewMarksOf,
  crewPhaseOf,
  crewRunOf,
  crewTaskOf,
  crewViewOf,
  crewsOf,
} from './crew-roster';
import { Crew } from './crew.types';

const tagged = (number: number, repo = 'me/app'): string =>
  `Observatory crew ship for ${repo}#${number}: update-branch\n\nYou are a crew…`;

const run = (fields: Partial<CrewRun> = {}): CrewRun => ({
  id: 'run-1',
  prompt: tagged(7),
  startedAt: 1_000,
  state: 'running',
  endedAt: null,
  ...fields,
});

const crew = (fields: Partial<Crew> = {}): Crew => ({
  repo: 'me/app',
  number: 7,
  runId: 'run-1',
  phase: 'working',
  state: 'running',
  startedAt: 1_000,
  endedAt: null,
  ...fields,
});

const context = (fields: Partial<CrewContext> = {}): CrewContext => ({
  task: 'update-branch',
  crew: null,
  isSending: false,
  isRunnerBusy: false,
  refusal: null,
  ...fields,
});

describe('crewTaskOf', () => {
  it('sends a crew to a conflicted or failing pull request only', () => {
    expect(crewTaskOf('conflicted', null)).toBe('update-branch');
    expect(crewTaskOf('failing', null)).toBe('fix-checks');
    for (const bucket of ['unknown', 'unlinked', 'unreviewed', 'fresh', null] as const) {
      expect(crewTaskOf(bucket, null)).toBeNull();
    }
  });

  it('updates a branch whose stacked base has merged, whatever its bucket', () => {
    const landed = { number: 12, branch: 'feat/12', into: 'main' };

    expect(crewTaskOf('unreviewed', landed)).toBe('update-stack');
    expect(crewTaskOf('conflicted', landed)).toBe('update-stack');
  });
});

describe('crewPhaseOf', () => {
  it('is working while the run is live, its stream dropped included', () => {
    for (const state of ['starting', 'running', 'stopping', 'reconnecting', 'lost'] as const) {
      expect(crewPhaseOf(state)).toBe('working');
    }
  });

  it('is back, done, only for a clean finish; any other ending failed', () => {
    expect(crewPhaseOf('done')).toBe('succeeded');
    for (const state of ['errored', 'failed', 'cancelled', 'time-limit', 'shutdown'] as const) {
      expect(crewPhaseOf(state)).toBe('failed');
    }
  });
});

describe('crewRunOf', () => {
  it('reads a clean exit with Claude Code’s own error as errored', () => {
    const result = {
      error: true,
      subtype: 'error_max_turns',
      costUsd: null,
      turns: null,
      durationMs: null,
    };

    expect(crewRunOf(summaryOf({ state: 'done', result })).state).toBe('errored');
    expect(crewRunOf(summaryOf({ state: 'done' })).state).toBe('done');
  });
});

describe('crewsOf', () => {
  it('finds crews by their prompt and leaves other tasks out', () => {
    const crews = crewsOf([run(), run({ id: 'run-2', prompt: 'Tidy the README' })]);

    expect(crews).toEqual([crew()]);
  });

  it('keeps each pull request’s newest crew, and a run’s first entry', () => {
    const crews = crewsOf([
      run({ id: 'new', startedAt: 5_000, state: 'running' }),
      run({ id: 'new', startedAt: 5_000, state: 'done', endedAt: 6_000 }),
      run({ id: 'old', startedAt: 1_000, state: 'failed', endedAt: 2_000 }),
      run({ id: 'other', prompt: tagged(8), state: 'done', endedAt: 3_000 }),
    ]);

    expect(crews.map((each) => [each.number, each.runId, each.phase])).toEqual([
      [7, 'new', 'working'],
      [8, 'other', 'succeeded'],
    ]);
  });

  it('finds a pull request’s crew whatever the repository’s case', () => {
    const crews = crewsOf([run({ prompt: tagged(7, 'Me/App') })]);

    expect(crewFor(crews, 'me/app', 7)?.runId).toBe('run-1');
    expect(crewFor(crews, 'me/app', 8)).toBeNull();
    expect(crewMarksOf(crews, 'me/app')).toEqual([{ pr: 7, phase: 'working', endedAt: null }]);
    expect(crewMarksOf(crews, 'me/other')).toEqual([]);
  });
});

describe('crewViewOf', () => {
  it('offers Send crew on a stuck pull request with no crew, saying what it does', () => {
    const view = crewViewOf(context());

    expect(view?.send).toEqual(expect.objectContaining({ label: 'Send crew', isDisabled: false }));
    expect(view?.send?.hint).toContain('never merges');
    expect(view?.status).toBeNull();
  });

  it('shows nothing on a pull request with no crew that needs none', () => {
    expect(crewViewOf(context({ task: null }))).toBeNull();
  });

  it('allows one crew per pull request: the button says one is out', () => {
    const view = crewViewOf(context({ crew: crew(), isRunnerBusy: true }));

    expect(view?.send).toEqual(expect.objectContaining({ label: 'Crew out', isDisabled: true }));
    expect(view?.status).toEqual({ text: 'Crew at work · Running', tone: 'live' });
  });

  it('waits while sending, and while another task holds the runner', () => {
    expect(crewViewOf(context({ isSending: true }))?.send?.isDisabled).toBe(true);
    expect(crewViewOf(context({ isRunnerBusy: true }))?.send).toEqual(
      expect.objectContaining({ label: 'Send crew', isDisabled: true }),
    );
  });

  it('says how a crew came back, and offers another once it has', () => {
    const done = crewViewOf(
      context({ crew: crew({ phase: 'succeeded', state: 'done', endedAt: 2 }) }),
    );
    const failed = crewViewOf(
      context({ crew: crew({ phase: 'failed', state: 'time-limit', endedAt: 2 }) }),
    );

    expect(done?.status).toEqual({ text: 'Crew back: done', tone: 'ok' });
    expect(failed?.status).toEqual({ text: 'Crew back: time limit', tone: 'bad' });
    expect(failed?.send?.label).toBe('Send crew');
  });

  it('keeps a returned crew’s status after its pull request is cleared, with no button', () => {
    const view = crewViewOf(
      context({ task: null, crew: crew({ phase: 'succeeded', state: 'done', endedAt: 2 }) }),
    );

    expect(view?.send).toBeNull();
    expect(view?.status?.tone).toBe('ok');
  });
});
