import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AskFeed } from '../assistant/ask-feed';
import { ProposalSlot, RunProposal, runProposalOf } from '../assistant/proposal';
import { ReplyLog } from '../assistant/reply-log';
import { ReplySpeech } from '../assistant/reply-speech';
import { Clock } from '../time/clock';
import { ARM_MS, RunOffer } from './run-offer';
import { RunDock } from './run-dock';
import { RunsApiError } from './runs-api';
import { RunsStore } from './runs-store';

const NOW = Date.UTC(2026, 8, 26, 14, 0, 0);
const VALID_MS = 5 * 60_000;

function setUp() {
  const isLive = signal(false);
  const store = {
    isLive,
    start: vi.fn<RunsStore['start']>(async () => undefined),
    refresh: vi.fn<RunsStore['refresh']>(async () => {
      isLive.set(true);
    }),
  };
  const dock = { show: vi.fn() };
  const feed = { leaveProposal: vi.fn(), proposeAgain: vi.fn() };
  const speech = { stop: vi.fn(() => false) };
  TestBed.configureTestingModule({
    providers: [
      RunOffer,
      { provide: RunsStore, useValue: store },
      { provide: RunDock, useValue: dock },
      { provide: AskFeed, useValue: feed },
      { provide: ReplySpeech, useValue: speech },
      { provide: Clock, useValue: { now: signal(new Date(NOW)).asReadonly() } },
    ],
  });
  const log = TestBed.inject(ReplyLog);
  const entryId = log.open('fix the sum test', 'typed');
  const proposal: RunProposal = runProposalOf(
    {
      reply: { ask: [], commands: [], sources: [], project: 'app' },
      prompt: 'Fix the failing sum test',
      entryId,
      ticket: {
        token: 't0k',
        folder: 'E:\\repos\\app',
        name: 'app',
        expiresAt: NOW + VALID_MS,
        limitMs: 30 * 60_000,
        command: 'claude -p --output-format stream-json --verbose',
      },
    },
    1,
    NOW,
  );
  TestBed.inject(ProposalSlot).show(proposal);
  const offer = TestBed.inject(RunOffer);
  offer.offer(proposal);
  const said = () => log.find(entryId)?.said.text;
  return { offer, proposal, store, dock, feed, speech, isLive, said };
}

describe('RunOffer', () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }));
  afterEach(() => vi.useRealTimers());

  it('arms Run only after a moment, so a doubled press cannot start a run', async () => {
    const { offer, store } = setUp();

    await offer.run();
    expect(offer.canRun()).toBe(false);
    expect(store.start).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(ARM_MS);
    expect(offer.canRun()).toBe(true);
  });

  it('starts the run with the proposal’s own token, prompt and folder, then shows it', async () => {
    const { offer, store, dock, speech, said } = setUp();
    await vi.advanceTimersByTimeAsync(ARM_MS);

    await offer.run();

    expect(speech.stop).toHaveBeenCalled();
    expect(store.start).toHaveBeenCalledWith({
      token: 't0k',
      prompt: 'Fix the failing sum test',
      folder: 'E:\\repos\\app',
    });
    expect(TestBed.inject(ProposalSlot).proposal()).toBeNull();
    expect(said()).toBe('Ran it: the task panel shows its output.');
    expect(dock.show).toHaveBeenCalled();
  });

  it('expires with its token, and offers to propose it again', async () => {
    const { offer, feed, proposal, said } = setUp();

    await vi.advanceTimersByTimeAsync(VALID_MS);

    expect(offer.canRun()).toBe(false);
    expect(offer.block()).toEqual(
      expect.objectContaining({
        text: 'This proposal expired. Send the request again.',
        actionLabel: 'Propose again',
      }),
    );
    expect(said()).toBe('Expired.');
    offer.pressBlock();
    expect(feed.proposeAgain).toHaveBeenCalledWith(proposal);
  });

  it('keeps the token when the runner is busy, and points at the run going', async () => {
    const { offer, store, dock } = setUp();
    await vi.advanceTimersByTimeAsync(ARM_MS);
    store.start.mockRejectedValueOnce(new RunsApiError(409, 'a run is already going'));

    await offer.run();

    expect(store.refresh).toHaveBeenCalled();
    expect(offer.isStarting()).toBe(false);
    expect(offer.block()).toEqual(
      expect.objectContaining({
        text: 'A run is already going. Cancel it or wait.',
        actionLabel: 'Show the run',
      }),
    );
    offer.pressBlock();
    expect(dock.show).toHaveBeenCalled();
  });

  it('says a refused token is no longer valid, in red', async () => {
    const { offer, store } = setUp();
    await vi.advanceTimersByTimeAsync(ARM_MS);
    store.start.mockRejectedValueOnce(new RunsApiError(403, 'the proposal was no longer valid'));

    await offer.run();

    expect(offer.block()).toEqual(
      expect.objectContaining({
        text: 'Home couldn’t start this run: the proposal was no longer valid. Send the request again.',
        isBad: true,
        actionLabel: 'Propose again',
      }),
    );
  });

  it('says what else went wrong in the runner’s own words', async () => {
    const { offer, store } = setUp();
    await vi.advanceTimersByTimeAsync(ARM_MS);
    store.start.mockRejectedValueOnce(
      new RunsApiError(400, 'token, prompt and folder are required'),
    );

    await offer.run();

    expect(offer.block()?.text).toBe(
      'Home couldn’t start this run: token, prompt and folder are required.',
    );
  });

  it('says Left it on its reply when cancelled', () => {
    const { offer, feed, proposal } = setUp();

    offer.leave();

    expect(feed.leaveProposal).toHaveBeenCalledWith(proposal.entryId);
  });

  it('cannot run while another run is live', async () => {
    const { offer, isLive } = setUp();
    await vi.advanceTimersByTimeAsync(ARM_MS);

    isLive.set(true);

    expect(offer.canRun()).toBe(false);
    expect(offer.block()?.actionLabel).toBe('Show the run');
  });
});
