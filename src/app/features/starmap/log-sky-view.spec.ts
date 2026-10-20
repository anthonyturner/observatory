import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LogsFeed } from '../../core/logs/logs-feed';
import { LOG_FIXTURE, LOG_FIXTURE_WITH_OLDER } from '../../core/logs/testing/log-fixture';
import { LogSkyView } from './log-sky-view';

function view() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), LogsFeed, LogSkyView],
  });
  const logs = TestBed.inject(LogSkyView);
  logs.watch('me/a');
  const request = TestBed.inject(HttpTestingController).expectOne('/api/logs?repo=me/a');
  return { logs, request };
}

describe('LogSkyView', () => {
  it('lays the snapshot out and legends it', () => {
    const { logs, request } = view();
    request.flush(LOG_FIXTURE);

    expect(logs.layout().stars.length).toBeGreaterThan(0);
    expect(logs.chips().map((chip) => chip.id)).toEqual(['error', 'warn', 'quiet']);
    expect(logs.message()).toBeNull();
  });

  it('says what to do when no folder is set', () => {
    const { logs, request } = view();
    request.flush({ configured: false, reason: 'not-set' });

    expect(logs.message()?.headline).toBe('No logs charted yet.');
    expect(logs.stamp()).toBe('no logs yet');
  });

  it('traces a picked fault, keeps the trace when its card closes, clears it on a filter', () => {
    const { logs, request } = view();
    request.flush(LOG_FIXTURE);
    const fault = logs.layout().stars.find((s) => s.kind === 'fault') ?? null;

    logs.pick(fault);
    expect(logs.selected()).toBe(fault);
    expect(logs.traced()).toBe(fault);
    logs.closeCard();
    expect(logs.selected()).toBeNull();
    expect(logs.traced()).toBe(fault);
    logs.toggleFilter('error');
    expect(logs.traced()).toBeNull();
    expect(logs.filter()).toBe('error');
  });

  it('follows the same fault into a new layout', () => {
    const { logs, request } = view();
    request.flush(LOG_FIXTURE);
    const fault = logs.layout().stars.find((s) => s.kind === 'fault') ?? null;
    logs.pick(fault);

    logs.follow();

    expect(logs.selected()?.fault?.text).toBe(fault?.fault?.text);
  });

  describe('older faults', () => {
    const fault = (logs: ReturnType<typeof view>['logs'], id: number) =>
      logs.layout().stars.some((star) => star.fault?.id === id);

    it('leaves them out of the sky, and says how many there are', () => {
      const { logs, request } = view();
      request.flush(LOG_FIXTURE_WITH_OLDER);

      expect(logs.olderCount()).toBe(3);
      expect(logs.isShowingOlder()).toBe(false);
      expect(fault(logs, 6)).toBe(false);
      expect(logs.chips().find((chip) => chip.id === 'error')?.count).toBe(7);
    });

    it('draws them and counts them in while they are shown, and leaves them out again', () => {
      const { logs, request } = view();
      request.flush(LOG_FIXTURE_WITH_OLDER);

      logs.toggleOlder();

      expect(logs.isShowingOlder()).toBe(true);
      expect(fault(logs, 6)).toBe(true);
      expect(logs.chips().find((chip) => chip.id === 'error')?.count).toBe(27);
      expect(logs.olderCount()).toBe(3);

      logs.toggleOlder();

      expect(fault(logs, 6)).toBe(false);
      expect(logs.chips().find((chip) => chip.id === 'error')?.count).toBe(7);
    });

    it('is shown afresh for the next project, not carried over', () => {
      const { logs, request } = view();
      request.flush(LOG_FIXTURE_WITH_OLDER);
      logs.toggleOlder();

      logs.watch('me/b');

      expect(logs.isShowingOlder()).toBe(false);
    });
  });
});
