import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { ELEMENT_SIZE, ElementSize } from '../element-size/element-size';
import { PanZoom } from './pan-zoom';
import { Area } from './viewport';

@Component({
  imports: [PanZoom],
  template: `
    <svg [appPanZoom]="area()" #camera="panZoom">
      <g [attr.transform]="camera.transform()">
        <circle class="dot" r="5" (click)="clicks = clicks + 1" />
      </g>
    </svg>
  `,
})
class Host {
  readonly area = signal<Area>({ x: -1000, y: -1000, width: 2000, height: 2000 });
  clicks = 0;
}

function mount(size: ElementSize | null = { width: 1000, height: 600 }) {
  const sizes = new BehaviorSubject<ElementSize>(size ?? { width: 0, height: 0 });
  TestBed.configureTestingModule({ providers: [{ provide: ELEMENT_SIZE, useValue: () => sizes }] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGSVGElement;
  const transform = (): string | null => {
    fixture.detectChanges();
    return svg.querySelector('g')?.getAttribute('transform') ?? null;
  };
  return { fixture, svg, sizes, transform };
}

const pointer = (type: string, x: number, y: number): PointerEvent =>
  Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }), {
    pointerId: 1,
  }) as PointerEvent;

describe('PanZoom', () => {
  it('opens a large drawing readable and centred', () => {
    expect(mount().transform()).toBe('translate(500 300) scale(0.8)');
  });

  it('keeps the drawing hidden until the frame has a size', () => {
    const { sizes, transform } = mount(null);
    expect(transform()).toBe('scale(0)');
    sizes.next({ width: 1000, height: 600 });
    expect(transform()).toBe('translate(500 300) scale(0.8)');
  });

  it('pans with a drag and does not click what the drag ends on', () => {
    const { fixture, svg, transform } = mount();
    const dot = svg.querySelector('.dot') as SVGCircleElement;
    dot.dispatchEvent(pointer('pointerdown', 100, 100));
    dot.dispatchEvent(pointer('pointermove', 150, 120));
    dot.dispatchEvent(pointer('pointerup', 150, 120));
    dot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(transform()).toBe('translate(550 320) scale(0.8)');
    expect(fixture.componentInstance.clicks).toBe(0);

    dot.dispatchEvent(pointer('pointerdown', 150, 120));
    dot.dispatchEvent(pointer('pointerup', 150, 120));
    dot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fixture.componentInstance.clicks).toBe(1);
  });

  it('zooms with keys and fits on 0', () => {
    const { svg, transform } = mount();
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    expect(transform()).toBe('translate(500 300) scale(1)');
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true }));
    expect(transform()).toBe('translate(500 300) scale(0.276)');
  });

  it('keeps the zoom and centres a new drawing', () => {
    const { fixture, svg, transform } = mount();
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    fixture.componentInstance.area.set({ x: 0, y: 0, width: 200, height: 200 });
    expect(transform()).toBe('translate(400 200) scale(1)');
  });
});
