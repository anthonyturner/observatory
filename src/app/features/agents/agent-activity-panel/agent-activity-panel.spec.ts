import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AGENT_FEED_API } from '../../../core/live-agents/agent-feed-api';
import { AgentFeedRead } from '../../../core/live-agents/agent-feed.types';
import { liveAgent } from '../../../core/live-agents/testing/live-agent-fixture';
import { AgentActivityPanel } from './agent-activity-panel';

const said = (text: string) => ({
  type: 'assistant',
  message: { content: [{ type: 'text', text }] },
});

function render(read: AgentFeedRead) {
  TestBed.configureTestingModule({
    providers: [{ provide: AGENT_FEED_API, useValue: { feed: () => of(read) } }],
  });
  const fixture = TestBed.createComponent(AgentActivityPanel);
  fixture.componentRef.setInput('agent', liveAgent());
  TestBed.tick();
  fixture.detectChanges();
  return { fixture, panel: fixture.nativeElement as HTMLElement };
}

function found<T extends Element>(element: T | null): T {
  if (!element) throw new Error('not rendered');
  return element;
}

/** jsdom lays nothing out, so a test gives the scroller its measurements. */
function measure(scroller: HTMLElement, sizes: { scrollHeight: number; clientHeight: number }) {
  for (const [name, value] of Object.entries(sizes)) {
    Object.defineProperty(scroller, name, { configurable: true, value });
  }
}

describe('AgentActivityPanel', () => {
  it('follows the newest rows, and offers Jump to latest once the reader scrolls up', () => {
    const { fixture, panel } = render({
      status: 'ready',
      page: { events: [said('One.'), said('Two.')], next: 10, isRestart: true },
    });
    const scroller = found(panel.querySelector<HTMLElement>('.scroller'));
    expect(panel.querySelector('.latest')).toBeNull();

    measure(scroller, { scrollHeight: 1000, clientHeight: 200 });
    scroller.scrollTop = 100;
    scroller.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    const jump = found(panel.querySelector<HTMLButtonElement>('.latest'));
    expect(jump.textContent?.trim()).toBe('Jump to latest');

    jump.click();
    TestBed.tick();
    fixture.detectChanges();

    expect(scroller.scrollTop).toBe(1000);
    expect(panel.querySelector('.latest')).toBeNull();
  });

  it('says so when the agent has said and done nothing yet', () => {
    const { panel } = render({
      status: 'ready',
      page: { events: [], next: 0, isRestart: true },
    });

    expect(panel.textContent).toContain('Nothing said or done yet.');
  });
});
