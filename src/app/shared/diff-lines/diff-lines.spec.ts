import { TestBed } from '@angular/core/testing';
import { DiffLine } from '../../core/queue/diff-files';
import { DiffLines } from './diff-lines';

const line = (extra: Partial<DiffLine>): DiffLine => ({
  kind: '',
  sign: ' ',
  text: 'code',
  oldNumber: 1,
  newNumber: 1,
  parts: null,
  ...extra,
});

const LINES: DiffLine[] = [
  line({ text: 'keep' }),
  line({ kind: 'd', sign: '-', text: 'old', oldNumber: 2, newNumber: null }),
  line({
    kind: 'a',
    sign: '+',
    text: 'new',
    oldNumber: null,
    newNumber: 2,
    parts: [
      { text: 'n', changed: true },
      { text: 'ew', changed: false },
    ],
  }),
];

function render(reveal: number | null = null) {
  localStorage.clear();
  const fixture = TestBed.createComponent(DiffLines);
  fixture.componentRef.setInput('lines', LINES);
  fixture.componentRef.setInput('reveal', reveal);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('DiffLines', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it('draws each line with its numbers, sign and code, and marks the words that changed', () => {
    const { element } = render();

    const rows = [...element.querySelectorAll('pre > span')];
    expect(rows.map((row) => row.className)).toEqual(['', 'd', 'a']);
    expect(rows[2].querySelectorAll('.n')[1].textContent).toBe('2');
    expect(rows[2].querySelector('.s')?.textContent).toBe('+');
    expect(rows[2].querySelector('.w')?.textContent).toBe('n');
    expect(rows[2].querySelector('.c')?.textContent).toBe('new');
  });

  it('wraps long lines until the shared choice is to scroll them', () => {
    const { fixture, element } = render();
    expect(element.classList.contains('wrap')).toBe(true);

    localStorage.setItem('observatory.diff-wrap', 'scroll');
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'observatory.diff-wrap', newValue: 'scroll' }),
    );
    fixture.detectChanges();

    expect(element.classList.contains('wrap')).toBe(false);
  });

  it('lays out only the lines near the window for a long file, and every line of a short one', () => {
    // Drawing two thousand lines is the cost being avoided; the class is all that is asked about.
    TestBed.overrideComponent(DiffLines, { set: { template: '<pre #code></pre>' } });
    const fixture = TestBed.createComponent(DiffLines);
    const isLong = (count: number): boolean => {
      fixture.componentRef.setInput(
        'lines',
        Array.from({ length: count }, (_, index) => line({ text: `line ${index}` })),
      );
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).classList.contains('long');
    };

    expect(isLong(2000)).toBe(false);
    expect(isLong(2001)).toBe(true);
  });

  it('brings the line to reveal into the middle of the window, and none when not asked', () => {
    const { element } = render(2);

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts[0]).toBe(
      element.querySelectorAll('pre > span')[2],
    );

    vi.mocked(Element.prototype.scrollIntoView).mockClear();
    render(null);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});
