import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CrewDispatch } from '../../../core/crew/crew-dispatch';
import { Crew } from '../../../core/crew/crew.types';
import { QueueBucket } from '../../../core/queue/queue-report';
import { LandedBase } from '../../../core/queue/stacks';
import { CrewControl } from './crew-control';

const out: Crew = {
  repo: 'me/app',
  number: 7,
  runId: 'run-1',
  phase: 'working',
  state: 'running',
  startedAt: 1,
  endedAt: null,
};

interface Fields {
  readonly available?: boolean;
  readonly crews?: Crew[];
  readonly landed?: LandedBase;
}

function render(bucket: QueueBucket | null, fields: Fields = {}) {
  const dispatch = {
    isAvailable: signal(fields.available ?? true),
    crews: signal(fields.crews ?? []),
    isRunnerBusy: signal((fields.crews ?? []).some((crew) => crew.phase === 'working')),
    isSending: () => false,
    refusalFor: () => null,
    send: vi.fn(),
    showLog: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: CrewDispatch, useValue: dispatch }],
  });
  const fixture = TestBed.createComponent(CrewControl);
  fixture.componentRef.setInput('repo', 'me/app');
  fixture.componentRef.setInput('number', 7);
  fixture.componentRef.setInput('bucket', bucket);
  if (fields.landed) fixture.componentRef.setInput('landed', fields.landed);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  return { element, dispatch, button: element.querySelector<HTMLButtonElement>('button') };
}

describe('CrewControl', () => {
  it('offers Send crew on a conflicted pull request, and sends it on a press', () => {
    const { button, dispatch, element } = render('conflicted');

    expect(button?.textContent?.trim()).toBe('Send crew');
    expect(element.querySelector('.crew__hint')?.textContent).toContain('never merges');
    button?.click();

    expect(dispatch.send).toHaveBeenCalledWith('me/app', 7);
  });

  it('offers to update a pull request whose stacked base has merged', () => {
    const landed = { number: 6, branch: 'feat/6', into: 'main' };
    const { button, element } = render('unreviewed', { landed });

    expect(button?.textContent?.trim()).toBe('Send crew');
    expect(element.querySelector('.crew__hint')?.textContent).toContain('stacked on has merged');
  });

  it('shows nothing where no crew can be sent from, or on a pull request that needs none', () => {
    expect(render('failing', { available: false }).element.textContent?.trim()).toBe('');
    TestBed.resetTestingModule();
    expect(render('unreviewed').element.textContent?.trim()).toBe('');
  });

  it('says the crew is out, with its status and a link to its log', () => {
    const { button, element, dispatch } = render('conflicted', { crews: [out] });

    expect(button?.textContent?.trim()).toBe('Crew out');
    expect(button?.disabled).toBe(true);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Crew at work');
    element.querySelector<HTMLAnchorElement>('.crew__log')?.click();

    expect(dispatch.showLog).toHaveBeenCalledWith(out);
  });
});
