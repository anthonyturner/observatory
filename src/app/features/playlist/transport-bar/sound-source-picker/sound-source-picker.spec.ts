import { TestBed } from '@angular/core/testing';
import { SoundMenuGroup } from '../../../../core/music-sync/sources/sound-source-choice';
import { FakeSoundSource } from '../../../../core/music-sync/sources/testing/fake-sound-source';
import { SoundSourcePicker } from './sound-source-picker';

const tab = new FakeSoundSource('tab', [{ id: 'tab', label: 'tab' }]);
const input = new FakeSoundSource('input', [
  { id: 'input:mic', label: 'Microphone' },
  { id: 'input:mix', label: 'Stereo Mix' },
]);
const menu: readonly SoundMenuGroup[] = [
  { source: tab, options: tab.options() },
  { source: input, options: input.options() },
];

function render(selectedId: string, isPickGone = false) {
  const fixture = TestBed.createComponent(SoundSourcePicker);
  const option = menu.flatMap(({ options }) => options).find(({ id }) => id === selectedId);
  const source = menu.find(({ options }) => options.some(({ id }) => id === selectedId))?.source;
  fixture.componentRef.setInput('menu', menu);
  fixture.componentRef.setInput(
    'selected',
    option && source ? { source, option, isPickGone } : null,
  );
  fixture.componentRef.setInput('isBusy', false);
  fixture.detectChanges();
  const select = (fixture.nativeElement as HTMLElement).querySelector('select');
  if (!select) throw new Error('No select');
  return { fixture, select };
}

describe('SoundSourcePicker', () => {
  it('lists a source whose one entry says its name on its own, and heads the rest with it', () => {
    const { select } = render('tab');
    const group = select.querySelector('optgroup');
    expect(select.options[0].textContent?.trim()).toBe('tab');
    expect(select.options[0].parentElement).toBe(select);
    expect(group?.label).toBe('input');
    expect([...(group?.querySelectorAll('option') ?? [])].map((o) => o.value)).toEqual([
      'input:mic',
      'input:mix',
    ]);
  });

  it('selects the entry in use and names it in the tooltip', () => {
    const { select } = render('input:mix');
    expect(select.value).toBe('input:mix');
    expect(select.title).toContain('Stereo Mix');
  });

  it('marks the arrow and says so when the entry picked before is gone', () => {
    const { fixture, select } = render('input:mic', true);
    const arrow = (fixture.nativeElement as HTMLElement).querySelector('.arrow');
    expect(arrow?.textContent?.trim()).toBe('!');
    expect(select.title).toContain('picked before is not connected');
    expect(render('tab').select.title).not.toContain('picked before');
  });

  it('reports the entry picked', () => {
    const { fixture, select } = render('tab');
    const picked: string[] = [];
    fixture.componentInstance.picked.subscribe((id) => picked.push(id));
    select.value = 'input:mic';
    select.dispatchEvent(new Event('change'));
    expect(picked).toEqual(['input:mic']);
  });
});
