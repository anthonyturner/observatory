import { TestBed } from '@angular/core/testing';
import { noting } from './reply-entry';
import { REPLIES_KEPT, ReplyLog } from './reply-log';

describe('ReplyLog', () => {
  it('puts the newest first, and lets the oldest go past the cap', () => {
    const log = TestBed.inject(ReplyLog);
    for (let n = 1; n <= REPLIES_KEPT + 2; n++) log.open(`ask ${n}`, 'typed');

    expect(log.entries().length).toBe(REPLIES_KEPT);
    expect(log.entries()[0].asked).toBe(`ask ${REPLIES_KEPT + 2}`);
    expect(log.entries().at(-1)?.asked).toBe('ask 3');
  });

  it('changes one reply by its id', () => {
    const log = TestBed.inject(ReplyLog);
    const first = log.open('one', 'typed');
    log.open('two', 'spoken');

    log.say(first, noting('Left it.'));

    expect(log.find(first)?.said.text).toBe('Left it.');
    expect(log.entries()[0].said.text).toBe('');
  });
});
