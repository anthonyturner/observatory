import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { RERUN_API } from '../../../core/queue/rerun-api';
import { RerunControl } from './rerun-control';
import { rerunViewOf } from './rerun-view';

function render(answer: () => Observable<number>) {
  const api = { rerun: vi.fn(answer) };
  TestBed.configureTestingModule({ providers: [{ provide: RERUN_API, useValue: api }] });
  const fixture = TestBed.createComponent(RerunControl);
  fixture.componentRef.setInput('repo', 'me/app');
  fixture.componentRef.setInput('number', 7);
  fixture.componentRef.setInput('flakyChecks', ['e2e', 'e2e', 'lint']);
  const requested = vi.fn();
  fixture.componentInstance.requested.subscribe(requested);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = element.querySelector<HTMLButtonElement>('button');
  return { fixture, element, button, api, requested };
}

describe('rerunViewOf', () => {
  it('names each flaky check once in the hint', () => {
    const view = rerunViewOf({ status: 'idle' }, ['e2e', 'e2e', 'lint']);

    expect(view.hint).toBe(
      'Only flaky checks failed: e2e, lint. Runs their failed jobs again on GitHub.',
    );
  });

  it('holds the button while a rerun is asked for and after it started', () => {
    expect(rerunViewOf({ status: 'sending' }, ['e2e'])).toEqual(
      expect.objectContaining({ label: 'Rerunning…', isDisabled: true, status: null }),
    );
    expect(rerunViewOf({ status: 'sent', runs: 2 }, ['e2e'])).toEqual(
      expect.objectContaining({
        isDisabled: true,
        status: {
          text: 'Rerun started: 2 workflow runs. The star moves once its checks pass.',
          tone: 'ok',
        },
      }),
    );
  });

  it('offers the button again after a refusal, saying why', () => {
    const view = rerunViewOf({ status: 'refused', reason: 'it may still be running' }, ['e2e']);

    expect(view.isDisabled).toBe(false);
    expect(view.status).toEqual({ text: 'Couldn’t rerun: it may still be running.', tone: 'bad' });
  });
});

describe('RerunControl', () => {
  it('reruns on a press, then says it started and tells the page', () => {
    const { fixture, element, button, api, requested } = render(() => of(1));

    expect(button?.textContent?.trim()).toBe('Rerun');
    button?.click();
    fixture.detectChanges();

    expect(api.rerun).toHaveBeenCalledWith('me/app', 7);
    expect(requested).toHaveBeenCalledTimes(1);
    expect(button?.disabled).toBe(true);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('1 workflow run.');
  });

  it('asks once while a rerun is on its way', () => {
    const pending = new Subject<number>();
    const { fixture, button, api } = render(() => pending);

    button?.click();
    fixture.detectChanges();
    button?.click();

    expect(api.rerun).toHaveBeenCalledTimes(1);
    expect(button?.textContent?.trim()).toBe('Rerunning…');
  });

  it('says why GitHub would not rerun, and offers it again', () => {
    const { fixture, element, button, requested } = render(() =>
      throwError(() => new Error('#7 is not failing only on flaky checks')),
    );

    button?.click();
    fixture.detectChanges();

    expect(requested).not.toHaveBeenCalled();
    expect(button?.disabled).toBe(false);
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Couldn’t rerun: #7 is not failing only on flaky checks.',
    );
  });

  it('describes the button by the flaky checks it reruns', () => {
    const { element, button } = render(() => of(1));
    const hint = element.querySelector(`#${button?.getAttribute('aria-describedby')}`);

    expect(hint?.textContent).toContain('e2e, lint');
  });
});
