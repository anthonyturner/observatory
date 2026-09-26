import { TestBed } from '@angular/core/testing';
import { LogSnapshot } from '../../../core/logs/log-snapshot';
import { LOG_FIXTURE } from '../../../core/logs/testing/log-fixture';
import { MeteorRecord } from './meteor-record';

function render(snapshot: LogSnapshot = LOG_FIXTURE) {
  const fixture = TestBed.createComponent(MeteorRecord);
  fixture.componentRef.setInput('snapshot', snapshot);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('MeteorRecord', () => {
  it('captions the strip with its span and peak', () => {
    const { element } = render();
    const [what, range] = Array.from(element.querySelectorAll('figcaption > span'));

    expect(what.textContent).toBe('Errors and warnings per day');
    expect(range.querySelector('b')?.textContent).toBe('11');
    expect(range.textContent).toContain('√ height');
  });

  it('gives the day under the pointer its counts', () => {
    const { fixture, element } = render();
    const canvas = element.querySelector('canvas') as HTMLCanvasElement;
    canvas.getBoundingClientRect = () => new DOMRect(0, 0, 700, 58);

    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 260 }));
    fixture.detectChanges();
    expect(element.querySelector('.mtip')?.textContent).toContain(
      '3 errors · 4 warnings · 500 info',
    );

    canvas.dispatchEvent(new PointerEvent('pointerleave'));
    fixture.detectChanges();
    expect(element.querySelector('.mtip')).toBeNull();
  });

  it('hides itself when the logs span no day', () => {
    const { element } = render({ ...LOG_FIXTURE, span: { from: null, to: null } });

    expect(element.hidden).toBe(true);
  });
});
