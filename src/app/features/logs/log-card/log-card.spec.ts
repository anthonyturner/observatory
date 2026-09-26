import { TestBed } from '@angular/core/testing';
import { CLIPBOARD_WRITER, ClipboardWriter } from '../../../core/clipboard/clipboard-writer';
import { layoutLogs } from '../../../core/logs/log-layout';
import { LOG_FIXTURE, TEST_PALETTE } from '../../../core/logs/testing/log-fixture';
import { LogCard } from './log-card';

const { stars } = layoutLogs(LOG_FIXTURE, TEST_PALETTE);

async function render(
  star = stars[0],
  clipboard: ClipboardWriter = { write: () => Promise.resolve() },
) {
  TestBed.configureTestingModule({
    providers: [{ provide: CLIPBOARD_WRITER, useValue: clipboard }],
  });
  const fixture = TestBed.createComponent(LogCard);
  fixture.componentRef.setInput('star', star);
  fixture.componentRef.setInput('snapshot', LOG_FIXTURE);
  fixture.componentRef.setInput('repo', 'me/app');
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('LogCard', () => {
  it('shows a fault’s message with Copy message and Find in code', async () => {
    const { element } = await render();

    expect(element.querySelector('.bucketname')?.textContent).toBe('Error — desktop');
    expect(element.querySelector('.prno')?.textContent).toBe('×4');
    expect(element.querySelector('.excerpt')?.textContent).toBe(
      '[MatchApi] request failed with status #',
    );
    expect(element.querySelector('dd.hot')?.textContent).toContain('still burning');
    const find = element.querySelector<HTMLAnchorElement>('.cardacts a');
    expect(find?.textContent).toBe('Find in code');
    expect(find?.target).toBe('_blank');
  });

  it('copies the message, and says so when the browser refuses', async () => {
    const written: string[] = [];
    const { fixture, element } = await render(stars[0], {
      write: async (text) => {
        written.push(text);
      },
    });
    element.querySelector<HTMLButtonElement>('.cardacts button')?.click();
    await fixture.whenStable();

    expect(written).toEqual(['[MatchApi] request failed with status #']);
    expect(element.querySelector('.cardacts button')?.textContent).toBe('Copied');

    TestBed.resetTestingModule();
    const refused = await render(stars[0], { write: () => Promise.reject(new Error('no')) });
    refused.element.querySelector<HTMLButtonElement>('.cardacts button')?.click();
    await refused.fixture.whenStable();
    expect(refused.element.querySelector('.cardacts button')?.textContent).toBe(
      'Copy blocked — select the text above',
    );
  });

  it('gives a quiet window no actions', async () => {
    const { element } = await render(stars[5]);

    expect(element.querySelector('h2')?.textContent).toBe('No errors or warnings in 49 lines.');
    expect(element.querySelector('.cardacts')).toBeNull();
  });

  it('closes on × and on Esc', async () => {
    const { fixture, element } = await render();
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);

    element.querySelector<HTMLButtonElement>('.close')?.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closed).toBe(2);
  });
});
