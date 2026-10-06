import { TestBed } from '@angular/core/testing';
import { WipLimitSetting } from './wip-limit-setting';

describe('WipLimitSetting', () => {
  beforeEach(() => localStorage.clear());

  it('starts at 8 open pull requests', () => {
    expect(TestBed.inject(WipLimitSetting).limit()).toBe(8);
  });

  it('remembers the chosen limit', () => {
    TestBed.inject(WipLimitSetting).set(5);
    TestBed.resetTestingModule();

    expect(TestBed.inject(WipLimitSetting).limit()).toBe(5);
  });

  it('keeps to whole numbers from 1 to 50', () => {
    const setting = TestBed.inject(WipLimitSetting);
    setting.set(400);
    expect(setting.limit()).toBe(50);
    setting.set(0);
    expect(setting.limit()).toBe(1);
    setting.set(3.4);
    expect(setting.limit()).toBe(3);
    setting.set(Number.NaN);
    expect(setting.limit()).toBe(8);
  });

  it('falls back to 8 from a stored value it cannot read', () => {
    localStorage.setItem('observatory.wip-limit', 'lots');

    expect(TestBed.inject(WipLimitSetting).limit()).toBe(8);
  });
});
