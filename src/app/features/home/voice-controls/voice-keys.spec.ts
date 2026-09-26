import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PushToTalk } from '../../../core/voice/push-to-talk';
import { REPLY_VOICE } from '../../../core/voice/reply-voice';
import { VoiceKeys } from './voice-keys';

@Component({ template: '<input />', hostDirectives: [VoiceKeys] })
class Host {}

function setup(hasRecording = false) {
  const talk = {
    press: vi.fn(async () => undefined),
    release: vi.fn(),
    discard: vi.fn(() => hasRecording),
  };
  const stop = vi.fn(() => true);
  TestBed.configureTestingModule({
    providers: [
      { provide: PushToTalk, useValue: talk },
      {
        provide: REPLY_VOICE,
        useValue: { speak: async () => undefined, stop, speaking: signal(false) },
      },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  return { talk, stop, input: fixture.nativeElement.querySelector('input') as HTMLInputElement };
}

const key = (type: string, init: KeyboardEventInit) =>
  document.dispatchEvent(new KeyboardEvent(type, { bubbles: true, ...init }));

describe('VoiceKeys', () => {
  it('talks while M is held, counting a held key once', () => {
    const { talk } = setup();
    key('keydown', { key: 'm' });
    key('keydown', { key: 'm', repeat: true });
    key('keyup', { key: 'm' });
    expect(talk.press).toHaveBeenCalledTimes(1);
    expect(talk.press).toHaveBeenCalledWith('hold');
    expect(talk.release).toHaveBeenCalledTimes(1);
  });

  it('leaves M alone with a modifier, or typed into a field', () => {
    const { talk, input } = setup();
    key('keydown', { key: 'm', ctrlKey: true });
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
    expect(talk.press).not.toHaveBeenCalled();
  });

  it('throws a recording away on Esc, or else stops a reply', () => {
    const recording = setup(true);
    key('keydown', { key: 'Escape' });
    expect(recording.talk.discard).toHaveBeenCalled();
    expect(recording.stop).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    const quiet = setup(false);
    key('keydown', { key: 'Escape' });
    expect(quiet.stop).toHaveBeenCalled();
  });
});
