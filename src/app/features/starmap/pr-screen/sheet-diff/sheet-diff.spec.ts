import { TestBed } from '@angular/core/testing';
import { SheetDiff } from './sheet-diff';

const DIFF = [
  'diff --git a/x.ts b/x.ts',
  '--- a/x.ts',
  '+++ b/x.ts',
  '@@ -1 +1 @@',
  '-old',
  '+new',
  'diff --git a/y.ts b/y.ts',
  '--- a/y.ts',
  '+++ b/y.ts',
  '@@ -0,0 +1 @@',
  '+added',
].join('\n');

function render(diff = DIFF) {
  const fixture = TestBed.createComponent(SheetDiff);
  fixture.componentRef.setInput('diff', diff);
  fixture.componentRef.setInput('diffBytes', diff.length);
  fixture.componentRef.setInput('truncated', false);
  fixture.componentRef.setInput('viewedKey', 'me/app#9');
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const header = (index: number) =>
    element.querySelectorAll<HTMLButtonElement>('.head > button')[index];
  const checkbox = (path: string) =>
    element.querySelector<HTMLInputElement>(`input[aria-label="Viewed ${path}"]`)!;
  const click = (target: HTMLElement) => {
    target.click();
    fixture.detectChanges();
  };
  const tally = () => element.querySelector('.tally')?.textContent?.trim();
  return { fixture, element, header, checkbox, click, tally };
}

describe('SheetDiff', () => {
  beforeEach(() => localStorage.clear());

  it('counts the files viewed out of all of them', () => {
    const { checkbox, click, tally } = render();
    expect(tally()).toBe('0 / 2 viewed');

    click(checkbox('y.ts'));
    expect(tally()).toBe('1 / 2 viewed');
  });

  it('ticks a file as viewed when it is opened, and keeps the tick when closed', () => {
    const { header, checkbox, click, tally } = render();
    click(header(0));
    expect(header(0).getAttribute('aria-expanded')).toBe('true');
    expect(checkbox('x.ts').checked).toBe(true);
    expect(tally()).toBe('1 / 2 viewed');

    click(header(0));
    expect(header(0).getAttribute('aria-expanded')).toBe('false');
    expect(checkbox('x.ts').checked).toBe(true);
  });

  it('leaves an open file open when its tick is cleared and set again', () => {
    const { header, checkbox, click } = render();
    click(header(0));

    click(checkbox('x.ts'));
    expect(checkbox('x.ts').checked).toBe(false);
    expect(header(0).getAttribute('aria-expanded')).toBe('true');

    click(checkbox('x.ts'));
    expect(checkbox('x.ts').checked).toBe(true);
    expect(header(0).getAttribute('aria-expanded')).toBe('true');
  });

  it('leaves a closed file closed when it is ticked', () => {
    const { header, checkbox, click } = render();
    click(checkbox('x.ts'));

    expect(checkbox('x.ts').checked).toBe(true);
    expect(header(0).getAttribute('aria-expanded')).toBe('false');
  });

  it('unticks a file whose changes are different the next time', () => {
    const first = render();
    first.click(first.checkbox('x.ts'));
    first.click(first.checkbox('y.ts'));
    first.fixture.destroy();

    const changed = render(DIFF.replace('+new', '+newer'));
    expect(changed.checkbox('x.ts').checked).toBe(false);
    expect(changed.checkbox('y.ts').checked).toBe(true);
    expect(changed.tally()).toBe('1 / 2 viewed');
  });
});
