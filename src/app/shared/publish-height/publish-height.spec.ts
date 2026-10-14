import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { ELEMENT_SIZE } from '../element-size/element-size';
import { PublishHeight } from './publish-height';

@Component({
  imports: [PublishHeight],
  template: `@if (shown()) {
    <div appPublishHeight="--probe-height"></div>
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
  return {
    fixture,
    size,
    probe: () => document.documentElement.style.getPropertyValue('--probe-height'),
  };
}

describe('PublishHeight', () => {
  it('publishes the element’s height on the root', () => {
    const { probe } = setUp();

    expect(probe()).toBe('44px');
  });

  it('follows the height as it changes', () => {
    const { size, probe } = setUp();

    size.next({ width: 300, height: 33 });

    expect(probe()).toBe('33px');
  });

  it('takes the property away with the element', () => {
    const { fixture, probe } = setUp();

    fixture.componentInstance.shown.set(false);
    fixture.detectChanges();

    expect(probe()).toBe('');
  });
});
