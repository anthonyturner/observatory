import { TestBed } from '@angular/core/testing';
import { PageVisibility } from './page-visibility';

describe('PageVisibility', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'hidden');
  });

  it('follows the tab as it is hidden and shown again', () => {
    const visibility = TestBed.inject(PageVisibility);
    expect(visibility.isHidden()).toBe(false);

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(visibility.isHidden()).toBe(true);

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(visibility.isHidden()).toBe(false);
  });
});
