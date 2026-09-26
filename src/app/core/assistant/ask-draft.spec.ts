import { TestBed } from '@angular/core/testing';
import { AskDraft } from './ask-draft';

describe('AskDraft', () => {
  it('starts empty, with nothing heard', () => {
    const draft = TestBed.inject(AskDraft);

    expect(draft.isEmpty()).toBe(true);
    expect(draft.heard()).toBeNull();
  });

  it('follows the box, counting words heard so the same words twice arrive twice', () => {
    const draft = TestBed.inject(AskDraft);

    draft.noteBox('  ');
    expect(draft.isEmpty()).toBe(true);
    draft.add('stop');
    draft.add('stop');
    expect(draft.heard()).toEqual({ words: 'stop', n: 2 });
    expect(draft.isEmpty()).toBe(false);
    draft.noteBox('');
    expect(draft.isEmpty()).toBe(true);
  });
});
