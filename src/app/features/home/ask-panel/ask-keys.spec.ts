import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AskBoxFocus } from '../../../core/assistant/ask-box-focus';
import { AskFeed } from '../../../core/assistant/ask-feed';
import { PushToTalk } from '../../../core/voice/push-to-talk';
import { HelpShortcuts } from '../../../shared/help/help-shortcuts';
import { HelpState } from '../../../shared/help/help-state';
import { AskKeys } from './ask-keys';

@Component({
  imports: [AskKeys, HelpShortcuts],
  template: '<div appAskKeys appHelpShortcuts><input /></div>',
})
class Host {}

function setUp() {
  const feed = { hasPendingJump: signal(false), stayHere: vi.fn() };
  const talk = { isRecording: signal(false) };
  TestBed.configureTestingModule({
    providers: [
      { provide: AskFeed, useValue: feed },
      { provide: PushToTalk, useValue: talk },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
  const focus = TestBed.inject(AskBoxFocus);
  return { feed, talk, input, focus, help: TestBed.inject(HelpState) };
}

function press(key: string, options: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  return event;
}

describe('AskKeys', () => {
  it('sends / to the Ask box', () => {
    const { focus } = setUp();

    const event = press('/');

    expect(focus.requests()).toBe(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves / typed into a field, or with a modifier, alone', () => {
    const { focus, input } = setUp();

    press('/', {}, input);
    press('/', { ctrlKey: true });

    expect(focus.requests()).toBe(0);
  });

  it('takes Stay here on Esc while a page jump waits', () => {
    const { feed } = setUp();
    feed.hasPendingJump.set(true);

    const event = press('Escape');

    expect(feed.stayHere).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves Esc during a recording to voice, and the help card open', () => {
    const { feed, talk, help } = setUp();
    feed.hasPendingJump.set(true);
    talk.isRecording.set(true);
    help.toggle();

    const event = press('Escape');

    expect(event.defaultPrevented).toBe(true);
    expect(feed.stayHere).not.toHaveBeenCalled();
    expect(help.isOpen()).toBe(true);
  });

  it('lets an Esc it has no use for close the help card', () => {
    const { help } = setUp();
    help.toggle();

    const event = press('Escape');

    expect(event.defaultPrevented).toBe(false);
    expect(help.isOpen()).toBe(false);
  });
});
