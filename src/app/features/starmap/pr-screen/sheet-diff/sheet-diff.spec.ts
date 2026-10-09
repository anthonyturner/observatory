import { TestBed } from '@angular/core/testing';
import { SheetDiff, SheetDiffWording } from './sheet-diff';

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

function render(diff = DIFF, options: { truncated?: boolean; wording?: SheetDiffWording } = {}) {
  const fixture = TestBed.createComponent(SheetDiff);
  fixture.componentRef.setInput('diff', diff);
  fixture.componentRef.setInput('diffBytes', diff.length || 300 * 1024);
  fixture.componentRef.setInput('truncated', options.truncated ?? false);
  fixture.componentRef.setInput('viewedKey', 'me/app#9');
  if (options.wording) fixture.componentRef.setInput('wording', options.wording);
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
  const warning = () => element.querySelector('.warn')?.textContent?.replace(/\s+/g, ' ').trim();
  return { fixture, element, header, checkbox, click, tally, warning };
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

  it('says GitHub has the rest, as the PR screen does, unless told otherwise', () => {
    expect(render('').warning()).toBe(
      'This diff is too large to carry here (300 KB). Open it on GitHub.',
    );
    TestBed.resetTestingModule();
    expect(render(DIFF, { truncated: true }).warning()).toBe(
      'Shortened to fit — the full diff is on GitHub. Files near the end may be missing.',
    );
  });

  it('takes its own words for where the rest of the diff is', () => {
    const wording = { tooLarge: 'Run git diff there.', cutShort: 'Cut short.' };

    expect(render('', { wording }).warning()).toBe(
      'This diff is too large to carry here (300 KB). Run git diff there.',
    );
    TestBed.resetTestingModule();
    expect(render(DIFF, { truncated: true, wording }).warning()).toBe('Cut short.');
  });

  it('names a binary file as not shown, in place of its counts', () => {
    const binary = [
      'diff --git a/logo.png b/logo.png',
      'new file mode 100644',
      'Binary files /dev/null and b/logo.png differ',
    ].join('\n');

    const { header } = render(`${DIFF}\n${binary}`);

    const counts = [...header(2).children].map((child) => child.textContent?.trim());
    expect(counts).toEqual(['logo.png', 'binary, not shown']);
  });

  it('shows the folder apart from the file name, with the counts in their own spans', () => {
    const { header } = render(DIFF.replace(/x\.ts/g, 'src/app/x.ts'));

    expect(header(0).querySelector('.dir')?.textContent).toBe('src/app/');
    expect(header(0).querySelector('.name')?.textContent).toBe('x.ts');
    expect(header(0).querySelector('.add')?.textContent).toBe('+1');
    expect(header(0).querySelector('.del')?.textContent).toBe('−1');
  });

  describe('an opened file', () => {
    const CODE = [
      'diff --git a/x.ts b/x.ts',
      '@@ -4,2 +4,2 @@',
      ' keep',
      '-const total = price * 2;',
      '+const total = cost * 2;',
    ].join('\n');

    const open = () => {
      const view = render(CODE);
      view.click(view.header(0));
      const rows = [...view.element.querySelectorAll<HTMLElement>('pre > span')];
      const gutters = (row: HTMLElement) =>
        [...row.querySelectorAll('.n')].map((cell) => cell.textContent);
      return { ...view, rows, gutters };
    };

    it('numbers each line in an old and a new gutter', () => {
      const { rows, gutters } = open();

      expect(rows.map(gutters)).toEqual([['', ''], ['4', '4'], ['5', ''], ['', '5']]);
    });

    it('marks the changed words on both sides of a pair', () => {
      const { rows } = open();

      const marked = (row: HTMLElement) =>
        [...row.querySelectorAll('.w')].map((word) => word.textContent);
      expect(marked(rows[2])).toEqual(['price']);
      expect(marked(rows[3])).toEqual(['cost']);
    });

    it('keeps the code copyable without the numbers or signs', () => {
      const { rows } = open();

      expect(rows[3].querySelector('.c')?.textContent).toBe('const total = cost * 2;');
    });

    it('wraps long lines only when asked', () => {
      const { element, click } = open();
      const toggle = element.querySelector<HTMLInputElement>('.wrap-toggle input')!;
      expect(element.querySelector('.wrap')).toBeNull();

      click(toggle);
      expect(element.querySelector('.wrap pre')).not.toBeNull();

      click(toggle);
      expect(element.querySelector('.wrap')).toBeNull();
    });
  });
});
