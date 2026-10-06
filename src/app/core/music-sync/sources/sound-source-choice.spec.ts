import { TestBed } from '@angular/core/testing';
import { SoundSourceChoice } from './sound-source-choice';
import { SOUND_SOURCES } from './sound-sources';
import { FakeSoundSource } from './testing/fake-sound-source';

const STORAGE_KEY = 'observatory.music.sound-source';

function setup(...sources: FakeSoundSource[]) {
  TestBed.configureTestingModule({ providers: [{ provide: SOUND_SOURCES, useValue: sources }] });
  return TestBed.inject(SoundSourceChoice);
}

const idOf = (choice: SoundSourceChoice): string | undefined => choice.selected()?.option.id;

describe('SoundSourceChoice', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('starts on the first source on offer', () => {
    const choice = setup(new FakeSoundSource('tab'), new FakeSoundSource('computer'));
    expect(idOf(choice)).toBe('tab');
    expect(choice.selected()?.source.id).toBe('tab');
    expect(choice.hasChoice()).toBe(true);
  });

  it('keeps a picked source between visits', () => {
    setup(new FakeSoundSource('tab'), new FakeSoundSource('computer')).choose('computer');
    TestBed.resetTestingModule();
    expect(idOf(setup(new FakeSoundSource('tab'), new FakeSoundSource('computer')))).toBe(
      'computer',
    );
  });

  it('leaves out a source this browser cannot use, and offers no choice of one', () => {
    const computer = new FakeSoundSource('computer', []);
    const choice = setup(new FakeSoundSource('tab'), computer);
    expect(choice.menu().map(({ source }) => source.id)).toEqual(['tab']);
    expect(choice.hasChoice()).toBe(false);
  });

  it('falls back to the first on offer while the picked source is not', () => {
    const computer = new FakeSoundSource('computer');
    const choice = setup(new FakeSoundSource('tab'), computer);
    choice.choose('computer');
    computer.options.set([]);
    expect(idOf(choice)).toBe('tab');
    computer.options.set([{ id: 'computer', label: 'Whole computer' }]);
    expect(idOf(choice)).toBe('computer');
  });

  it('says so, and falls back to its source’s own entry, when the picked entry is gone', () => {
    const input = new FakeSoundSource('input', [
      { id: 'input', label: 'Default input' },
      { id: 'input:mic', label: 'Microphone' },
      { id: 'input:mix', label: 'Stereo Mix' },
    ]);
    const choice = setup(new FakeSoundSource('tab'), input);
    choice.choose('input:mix');
    expect(choice.selected()?.isPickGone).toBe(false);
    input.options.set([
      { id: 'input', label: 'Default input' },
      { id: 'input:mic', label: 'Microphone' },
    ]);
    expect(idOf(choice)).toBe('input');
    expect(choice.selected()?.isPickGone).toBe(true);
  });

  it('cannot tell a pick is gone while its source lists only its own entry', () => {
    const input = new FakeSoundSource('input', [{ id: 'input', label: 'Choose input…' }]);
    const choice = setup(new FakeSoundSource('tab'), input);
    choice.choose('input:mix');
    expect(idOf(choice)).toBe('input');
    expect(choice.selected()?.isPickGone).toBe(false);
  });

  it('treats an id no source offers as no pick at all', () => {
    localStorage.setItem(STORAGE_KEY, 'gone-for-good');
    expect(idOf(setup(new FakeSoundSource('tab')))).toBe('tab');
  });

  it('selects nothing where no source can be used, as on a phone', () => {
    const choice = setup(new FakeSoundSource('tab', []));
    expect(choice.selected()).toBeNull();
    expect(choice.menu()).toEqual([]);
  });
});
