import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AskBoxFocus } from '../../../core/assistant/ask-box-focus';
import { AssistantInfo } from '../../../core/assistant/assistant-info';
import { MICROPHONE } from '../../../core/voice/microphone';
import { PushToTalk } from '../../../core/voice/push-to-talk';
import { CoreTouch } from './core-touch';

function render({ canRecord = true, isElsewhere = false } = {}) {
  const press = vi.fn(async () => undefined);
  TestBed.configureTestingModule({
    providers: [
      { provide: AssistantInfo, useValue: { isElsewhere: signal(isElsewhere) } },
      { provide: MICROPHONE, useValue: { canRecord: () => canRecord } },
      { provide: PushToTalk, useValue: { press, isRecording: signal(false) } },
    ],
  });
  const fixture = TestBed.createComponent(CoreTouch);
  fixture.detectChanges();
  const surface = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
    'button.surface',
  )!;
  const click = (detail = 1) =>
    surface.dispatchEvent(new MouseEvent('click', { bubbles: true, detail, button: 0 }));
  return { surface, click, press };
}

describe('CoreTouch', () => {
  it('talks when the core is pressed without a drag, as the mic does', () => {
    const { surface, click, press } = render();

    expect(surface.getAttribute('aria-label')).toBe('Talk to Home');
    expect(surface.getAttribute('aria-pressed')).toBe('false');
    click();

    expect(press).toHaveBeenCalledWith('toggle');
  });

  it('talks from Enter or Space on the core too', () => {
    const { click, press } = render();

    click(0);

    expect(press).toHaveBeenCalledWith('toggle');
  });

  it('opens the ask box where voice cannot run', () => {
    const { surface, click, press } = render({ canRecord: false });
    const requests = TestBed.inject(AskBoxFocus).requests;

    expect(surface.getAttribute('aria-label')).toBe('Ask Home');
    click();

    expect(requests()).toBe(1);
    expect(press).not.toHaveBeenCalled();
  });

  it('only turns where there is no assistant, as on the hosted preview', () => {
    const { surface, click, press } = render({ isElsewhere: true });

    expect(surface.getAttribute('aria-label')).toBe('Core');
    expect(surface.hasAttribute('aria-pressed')).toBe(false);
    click();

    expect(press).not.toHaveBeenCalled();
    expect(TestBed.inject(AskBoxFocus).requests()).toBe(0);
  });
});
