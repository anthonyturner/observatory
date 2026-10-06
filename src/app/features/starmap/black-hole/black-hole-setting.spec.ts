import { TestBed } from '@angular/core/testing';
import { BlackHoleSetting } from './black-hole-setting';

describe('BlackHoleSetting', () => {
  beforeEach(() => localStorage.clear());

  it('starts at 14 idle days', () => {
    expect(TestBed.inject(BlackHoleSetting).staleAfterDays()).toBe(14);
  });

  it('remembers the chosen threshold', () => {
    TestBed.inject(BlackHoleSetting).set(30);
    TestBed.resetTestingModule();

    expect(TestBed.inject(BlackHoleSetting).staleAfterDays()).toBe(30);
  });

  it('keeps to whole days from 1 to 90', () => {
    const setting = TestBed.inject(BlackHoleSetting);
    setting.set(400);
    expect(setting.staleAfterDays()).toBe(90);
    setting.set(0);
    expect(setting.staleAfterDays()).toBe(1);
    setting.set(6.6);
    expect(setting.staleAfterDays()).toBe(7);
  });

  it('falls back to 14 from a stored value it cannot read', () => {
    localStorage.setItem('observatory.black-hole-days', 'soon');

    expect(TestBed.inject(BlackHoleSetting).staleAfterDays()).toBe(14);
  });
});
