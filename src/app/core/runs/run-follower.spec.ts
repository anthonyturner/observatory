import { FIRST_RETRY_MS, FollowListener, RECONNECTS, RunFollower } from './run-follower';
import { RunsApiError } from './runs-api';
import { FakeRunsApi } from './testing/fake-runs-api';
import { recordedEvents } from './testing/run-fixtures';

function listener(ended = () => false) {
  return {
    event: vi.fn<FollowListener['event']>(),
    reconnecting: vi.fn(),
    lost: vi.fn(),
    gone: vi.fn(),
    hasEnded: ended,
  } satisfies FollowListener;
}

const settle = () => vi.advanceTimersByTimeAsync(0);

function fakeApi() {
  const api = new FakeRunsApi();
  return { api, calls: api.follows };
}

describe('RunFollower', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('picks a dropped stream up again from the first event it has not seen', async () => {
    const { api, calls } = fakeApi();
    const told = listener();
    const follower = new RunFollower(api, { id: 'run-1', from: 3, listener: told });

    follower.start();
    expect(calls[0].from).toBe(3);
    calls[0].send(recordedEvents(3).slice(0, 4));
    calls[0].end();
    await settle();

    expect(told.event).toHaveBeenCalledTimes(4);
    expect(told.reconnecting).toHaveBeenCalledTimes(1);
    expect(follower.offset).toBe(7);

    await vi.advanceTimersByTimeAsync(FIRST_RETRY_MS);
    expect(calls[1].from).toBe(7);
  });

  it('waits twice as long each time, then gives up until asked again', async () => {
    const { api, calls } = fakeApi();
    const told = listener();
    const follower = new RunFollower(api, { id: 'run-1', from: 0, listener: told });

    follower.start();
    for (let drop = 0; drop < RECONNECTS; drop++) {
      calls[drop].end();
      await settle();
      await vi.advanceTimersByTimeAsync(FIRST_RETRY_MS * 2 ** drop - 1);
      expect(calls).toHaveLength(drop + 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(calls).toHaveLength(drop + 2);
    }
    calls[RECONNECTS].end();
    await settle();

    expect(told.lost).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(FIRST_RETRY_MS * 2 ** RECONNECTS);
    expect(calls).toHaveLength(RECONNECTS + 1);

    follower.reconnect();
    expect(calls).toHaveLength(RECONNECTS + 2);
  });

  it('counts the reconnects afresh once events come again', async () => {
    const { api, calls } = fakeApi();
    const told = listener();
    new RunFollower(api, { id: 'run-1', from: 0, listener: told }).start();

    for (let drop = 0; drop < RECONNECTS + 2; drop++) {
      calls[drop].send(recordedEvents(drop).slice(0, 1));
      calls[drop].end();
      await settle();
      await vi.advanceTimersByTimeAsync(FIRST_RETRY_MS);
    }

    expect(told.lost).not.toHaveBeenCalled();
  });

  it('ends quietly when the stream closes because the run has ended', async () => {
    const { api, calls } = fakeApi();
    const told = listener(() => true);
    new RunFollower(api, { id: 'run-1', from: 0, listener: told }).start();

    calls[0].end();
    await settle();

    expect(told.reconnecting).not.toHaveBeenCalled();
    expect(told.lost).not.toHaveBeenCalled();
  });

  it('says the run is gone when the runner no longer knows it', async () => {
    const { api, calls } = fakeApi();
    const told = listener();
    new RunFollower(api, { id: 'run-1', from: 0, listener: told }).start();

    calls[0].fail(new RunsApiError(404, 'no such run'));
    await settle();

    expect(told.gone).toHaveBeenCalledTimes(1);
    expect(told.reconnecting).not.toHaveBeenCalled();
  });

  it('treats any other failure as a dropped stream', async () => {
    const { api, calls } = fakeApi();
    const told = listener();
    new RunFollower(api, { id: 'run-1', from: 0, listener: told }).start();

    calls[0].fail(new TypeError('Failed to fetch'));
    await settle();

    expect(told.reconnecting).toHaveBeenCalledTimes(1);
  });

  it('stops following: aborts the stream, ignores late events and never retries', async () => {
    const { api, calls } = fakeApi();
    const told = listener();
    const follower = new RunFollower(api, { id: 'run-1', from: 0, listener: told });
    follower.start();

    follower.stop();
    expect(calls[0].signal?.aborted).toBe(true);
    calls[0].send(recordedEvents().slice(0, 1));
    calls[0].end();
    await vi.advanceTimersByTimeAsync(FIRST_RETRY_MS * 8);

    expect(told.event).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });
});
