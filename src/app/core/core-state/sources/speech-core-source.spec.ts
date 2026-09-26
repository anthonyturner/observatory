import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReplyTier } from '../../voice/reply-voice';
import { SpokenReplies } from '../../voice/spoken-replies';
import { CoreStateStore } from '../core-state-store';
import { SpeechCoreSource } from './speech-core-source';

function setUp() {
  const replies = { speaking: signal(false), tier: signal<ReplyTier | null>(null) };
  TestBed.configureTestingModule({
    providers: [SpeechCoreSource, { provide: SpokenReplies, useValue: replies }],
  });
  TestBed.inject(SpeechCoreSource).connect();
  TestBed.tick();
  return { replies, core: TestBed.inject(CoreStateStore) };
}

describe('SpeechCoreSource', () => {
  it('speaks with the reply’s tier from its first sound, and rests when it ends', () => {
    const { replies, core } = setUp();

    replies.speaking.set(true);
    replies.tier.set(2);
    TestBed.tick();
    expect(core.state()).toBe('speaking');
    expect(core.spokenTier()).toBe(2);

    replies.speaking.set(false);
    replies.tier.set(null);
    TestBed.tick();
    expect(core.state()).toBe('idle');
  });

  it('leaves the mic on the core when a press cuts the reply off', () => {
    const { replies, core } = setUp();
    replies.speaking.set(true);
    replies.tier.set(1);
    TestBed.tick();

    core.show('listening');
    replies.speaking.set(false);
    TestBed.tick();

    expect(core.state()).toBe('listening');
  });
});
