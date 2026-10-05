import { TestBed } from '@angular/core/testing';
import { MergeMethod } from '../../../../../core/edits/edit-record';
import { MergeSplit } from './merge-split';

function render(disabled = false) {
  const fixture = TestBed.createComponent(MergeSplit);
  fixture.componentRef.setInput('method', 'squash');
  fixture.componentRef.setInput('disabled', disabled);
  fixture.autoDetectChanges();
  document.body.appendChild(fixture.nativeElement);
  const element = fixture.nativeElement as HTMLElement;
  const picked: MergeMethod[] = [];
  let pressed = 0;
  fixture.componentInstance.pick.subscribe((method) => picked.push(method));
  fixture.componentInstance.press.subscribe(() => pressed++);
  const caret = element.querySelector<HTMLButtonElement>('.caret')!;
  const items = () =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
  const key = async (target: Element, name: string) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
    await fixture.whenStable();
  };
  return { fixture, element, caret, items, key, picked, pressed: () => pressed };
}

describe('MergeSplit', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('presses with the chosen method, unless disabled', async () => {
    const { element, pressed } = render();
    element.querySelector<HTMLButtonElement>('.main')!.click();
    expect(pressed()).toBe(1);

    const held = render(true);
    expect(held.element.querySelector<HTMLButtonElement>('.main')!.disabled).toBe(true);
    expect(held.caret.disabled).toBe(false);
  });

  it('opens on ArrowDown at the checked method, and moves with the arrows', async () => {
    const { caret, items, key } = render();
    await key(caret, 'ArrowDown');

    expect(caret.getAttribute('aria-expanded')).toBe('true');
    expect(items().map((item) => item.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(document.activeElement).toBe(items()[0]);
    await key(items()[0], 'ArrowDown');
    expect(document.activeElement).toBe(items()[1]);
    await key(items()[1], 'ArrowUp');
    await key(items()[0], 'ArrowUp');
    expect(document.activeElement).toBe(items()[2]);
  });

  it('closes on Escape without letting it reach the screen, and returns focus', async () => {
    const { caret, items, key } = render();
    let reached = 0;
    const count = () => reached++;
    document.addEventListener('keydown', count);
    await key(caret, 'ArrowDown');
    await key(items()[0], 'Escape');
    document.removeEventListener('keydown', count);

    expect(items()).toEqual([]);
    expect(reached).toBe(1);
    expect(document.activeElement).toBe(caret);
  });

  it('picks a method and closes; a click elsewhere closes too', async () => {
    const { fixture, caret, items, picked } = render();
    caret.click();
    await fixture.whenStable();
    items()[1].click();
    await fixture.whenStable();

    expect(picked).toEqual(['merge']);
    expect(items()).toEqual([]);
    caret.click();
    await fixture.whenStable();
    document.body.click();
    await fixture.whenStable();
    expect(items()).toEqual([]);
  });
});
