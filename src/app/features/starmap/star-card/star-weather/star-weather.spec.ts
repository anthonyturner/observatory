import { TestBed } from '@angular/core/testing';
import { DesignFlag, PullWeather } from '../../../../core/queue/weather';
import { StarWeather } from './star-weather';

const todo = (line: number): DesignFlag => ({
  kind: 'untracked-todo',
  path: 'src/a.ts',
  line,
  note: 'TODO with no issue',
  excerpt: '// TODO: later',
});

function render(weather: PullWeather | undefined): HTMLElement {
  const fixture = TestBed.createComponent(StarWeather);
  fixture.componentRef.setInput('weather', weather);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const pull = (flags: readonly DesignFlag[], scanned = true): PullWeather => ({
  number: 7,
  headSha: 'abc',
  scanned,
  flags,
});

describe('StarWeather', () => {
  it('shows nothing until the weather is in', () => {
    expect(render(undefined).textContent?.trim()).toBe('');
  });

  it('says the sky is clear, or that the diff could not be read', () => {
    expect(render(pull([])).textContent).toContain('Clear skies');
    expect(render(pull([], false)).textContent).toContain('Weather unknown');
  });

  it('lists each flag with where it is and the principle it breaks', () => {
    const element = render(
      pull([
        todo(3),
        {
          kind: 'swallowed-error',
          path: 'src/b.ts',
          line: 9,
          note: 'empty catch',
          excerpt: '} catch {}',
        },
      ]),
    );

    expect(element.querySelector('.heading')?.textContent?.trim()).toBe('Squall · 2 red flags');
    expect([...element.querySelectorAll('.place')].map((each) => each.textContent)).toEqual([
      'src/a.ts:3',
      'src/b.ts:9',
    ]);
    expect(element.querySelector('.principle')?.textContent).toContain('follow-up');
  });

  it('lists the first five and counts the rest', () => {
    const element = render(pull([1, 2, 3, 4, 5, 6, 7].map(todo)));

    expect(element.querySelectorAll('li').length).toBe(5);
    expect(element.querySelector('.more')?.textContent).toContain('2 more');
  });
});
