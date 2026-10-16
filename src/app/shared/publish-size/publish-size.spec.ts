import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { ELEMENT_SIZE } from '../element-size/element-size';
import { PublishSize } from './publish-size';

@Component({
  imports: [PublishSize],
  template: `@if (shown()) {
    <div appPublishHeight="--probe-height" appPublishWidth="--probe-width"></div>
    <div appPublishHeight="--only-height"></div>
  }`,
})
class Host {
  shown = signal(true);
}

function setUp() {
  const size = new BehaviorSubject({ width: 300, height: 44 });
  TestBed.configureTestingModule({
    providers: [{ provide: ELEMENT_SIZE, useValue: () => size }],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = document.documentElement.style;
  return { fixture, size, probe: (name: string) => root.getPropertyValue(name) };
}

describe('PublishSize', () => {
  it('publishes the element’s height and width on the root, as asked', () => {
    const { probe } = setUp();

    expect([probe('--probe-height'), probe('--probe-width'), probe('--only-height')]).toEqual([
      '44px',
      '300px',
      '44px',
    ]);
  });

  it('publishes only what it was asked for', () => {
    const { probe } = setUp();

    expect(probe('--only-width')).toBe('');
  });

  it('follows the size as it changes', () => {
    const { size, probe } = setUp();

    size.next({ width: 280, height: 33 });

    expect([probe('--probe-height'), probe('--probe-width')]).toEqual(['33px', '280px']);
  });

  it('takes the properties away with the element', () => {
    const { fixture, probe } = setUp();

    fixture.componentInstance.shown.set(false);
    fixture.detectChanges();

    expect([probe('--probe-height'), probe('--probe-width'), probe('--only-height')]).toEqual([
      '',
      '',
      '',
    ]);
  });
});
