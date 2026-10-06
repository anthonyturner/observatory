import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';
import { AssistantInfo } from '../assistant/assistant-info';
import { ReplySpeech } from '../assistant/reply-speech';
import { Clock } from '../time/clock';
import { RUN_CACHE_STORAGE } from '../runs/run-cache';
import { RUNS_API, RunsApiError } from '../runs/runs-api';
import { RunEvent, RunsReport, StartRequest } from '../runs/runs.types';
import { FakeRunsApi } from '../runs/testing/fake-runs-api';
import { STARTED_AT, summaryOf } from '../runs/testing/run-fixtures';
import { CREW_API, CrewApi } from './crew-api';
import { CrewDispatch } from './crew-dispatch';

const PROMPT = 'Observatory crew ship for me/app#7: update-branch\n\nYou are a crew…';
const REQUEST: StartRequest = { token: 't-1', prompt: PROMPT, folder: 'E:\\repos\\app' };

class FakeCrewApi implements CrewApi {
  readonly proposed: [string, number][] = [];
  available = true;
  answer: () => Observable<StartRequest> = () => of(REQUEST);
  availabilityAsked = 0;

  isAvailable(): Observable<boolean> {
    this.availabilityAsked++;
    return of(this.available);
  }

  propose(repo: string, number: number): Observable<StartRequest> {
    this.proposed.push([repo, number]);
    return this.answer();
  }
}

const stateEvent = (n: number, data: Record<string, unknown>): RunEvent => ({
  n,
  at: STARTED_AT + n,
  kind: 'state',
  data,
});

interface SetUpOptions {
  readonly where?: 'local' | 'hosted';
  readonly hasRunner?: boolean;
  readonly report?: RunsReport;
}

function setUp({ where = 'local', hasRunner = true, report }: SetUpOptions = {}) {
  const runs = new FakeRunsApi();
  const crew = new FakeCrewApi();
  crew.available = hasRunner;
  if (report) runs.report = report;
  runs.startAnswer = async () => summaryOf({ id: 'crew-run', prompt: PROMPT, state: 'starting' });
  TestBed.configureTestingModule({
    providers: [
      { provide: RUNS_API, useValue: runs },
      { provide: CREW_API, useValue: crew },
      { provide: RUN_CACHE_STORAGE, useValue: sessionStorage },
      { provide: Clock, useValue: { now: signal(new Date(STARTED_AT)).asReadonly() } },
      { provide: ReplySpeech, useValue: { stop: () => false } },
      {
        provide: AssistantInfo,
        useValue: { where: signal(where).asReadonly(), isElsewhere: signal(false).asReadonly() },
      },
    ],
  });
  const dispatch = TestBed.inject(CrewDispatch);
  TestBed.tick();
  return { dispatch, runs, crew };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

describe('CrewDispatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('can send a crew on the local site when the API has a runner', () => {
    const { dispatch, crew } = setUp();

    expect(dispatch.isAvailable()).toBe(true);
    expect(crew.availabilityAsked).toBe(1);
  });

  it('cannot on the hosted site, which it never asks', () => {
    const { dispatch, crew } = setUp({ where: 'hosted' });

    expect(dispatch.isAvailable()).toBe(false);
    expect(crew.availabilityAsked).toBe(0);
  });

  it('cannot when the local API has no runner', () => {
    const { dispatch } = setUp({ hasRunner: false });

    expect(dispatch.isAvailable()).toBe(false);
  });

  it('starts the crew the API proposed, word for word, and shows it at work', async () => {
    const { dispatch, runs, crew } = setUp();

    dispatch.send('me/app', 7);
    expect(dispatch.isSending('me/app', 7)).toBe(true);
    await settle();

    expect(crew.proposed).toEqual([['me/app', 7]]);
    expect(runs.started).toEqual([REQUEST]);
    expect(dispatch.isSending('me/app', 7)).toBe(false);
    expect(dispatch.crews()).toEqual([
      expect.objectContaining({ repo: 'me/app', number: 7, runId: 'crew-run', phase: 'working' }),
    ]);
    expect(dispatch.isRunnerBusy()).toBe(true);
  });

  it('sends one crew at a time: a second send while one is out does nothing', async () => {
    const { dispatch, runs, crew } = setUp();
    dispatch.send('me/app', 7);
    await settle();

    dispatch.send('me/app', 7);
    dispatch.send('me/app', 8);
    await settle();

    expect(crew.proposed).toHaveLength(1);
    expect(runs.started).toHaveLength(1);
  });

  it('brings the crew back done, or failed, as its run ends', async () => {
    const { dispatch, runs } = setUp();
    dispatch.send('me/app', 7);
    await settle();

    runs.follows[0].send([
      stateEvent(0, { state: 'running' }),
      stateEvent(1, { state: 'done', code: 0, endedAt: STARTED_AT + 60_000 }),
    ]);
    runs.follows[0].end();
    await settle();

    expect(dispatch.crews()[0]).toEqual(
      expect.objectContaining({ phase: 'succeeded', state: 'done', endedAt: STARTED_AT + 60_000 }),
    );
    expect(dispatch.isRunnerBusy()).toBe(false);
  });

  it('marks a crew that failed as failed', async () => {
    const { dispatch, runs } = setUp();
    dispatch.send('me/app', 7);
    await settle();

    runs.follows[0].send([stateEvent(0, { state: 'failed', code: 1, endedAt: STARTED_AT + 5 })]);
    runs.follows[0].end();
    await settle();

    expect(dispatch.crews()[0].phase).toBe('failed');
  });

  it('says why a crew could not launch, on that pull request only', async () => {
    const { dispatch, crew } = setUp();
    const refusal = new Subject<StartRequest>();
    crew.answer = () => refusal;

    dispatch.send('me/app', 7);
    refusal.error(
      new RunsApiError(403, 'only a conflicted or failing pull request can be sent a crew'),
    );
    await settle();

    expect(dispatch.refusalFor('me/app', 7)).toBe(
      'The crew couldn’t launch: only a conflicted or failing pull request can be sent a crew.',
    );
    expect(dispatch.refusalFor('me/app', 8)).toBeNull();
    expect(dispatch.isSending('me/app', 7)).toBe(false);
  });

  it('says so when another task took the runner first', async () => {
    const { dispatch, runs } = setUp();
    runs.startAnswer = () => Promise.reject(new RunsApiError(409, 'a run is already going'));

    dispatch.send('me/app', 7);
    await settle();

    expect(dispatch.refusalFor('me/app', 7)).toBe(
      'Another task started first. Send the crew once it ends.',
    );
  });

  it('finds a crew already out from the runner’s list, as after a reload', async () => {
    const { dispatch } = setUp({
      report: { current: summaryOf({ id: 'out', prompt: PROMPT }), recent: [] },
    });
    await settle();

    expect(dispatch.crews()).toEqual([expect.objectContaining({ runId: 'out', phase: 'working' })]);
  });
});
