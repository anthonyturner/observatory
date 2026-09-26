import { VoiceError } from './voice-error';
import { within } from './within';

describe('within', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('settles as the promise does when it is in time', async () => {
    await expect(within(Promise.resolve('said'), 100, 'run')).resolves.toBe('said');
    await expect(within(Promise.reject(new Error('no')), 100, 'run')).rejects.toThrow('no');
  });

  it('fails with the kind given once the time is up', async () => {
    const late = within(new Promise<never>(() => undefined), 100, 'model');
    const failed = expect(late).rejects.toSatisfy(
      (error: unknown) => error instanceof VoiceError && error.kind === 'model',
    );
    await vi.advanceTimersByTimeAsync(100);
    await failed;
  });
});
