import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PageScore, Score } from './page-score';

function scoreOf(isOn: boolean): Score {
  const on = signal(isOn);
  return { isOn: on.asReadonly(), toggle: () => on.update((value) => !value) };
}

describe('PageScore', () => {
  it('is off while no page has a score', () => {
    const page = TestBed.inject(PageScore);
    expect(page.isOn()).toBe(false);
    page.silence();
    expect(page.isOn()).toBe(false);
  });

  it('follows the score registered last, and turns it off when asked', () => {
    const page = TestBed.inject(PageScore);
    const score = scoreOf(true);
    page.register(score);
    expect(page.isOn()).toBe(true);
    page.silence();
    expect(score.isOn()).toBe(false);
    expect(page.isOn()).toBe(false);
  });

  it('leaves a quiet score off rather than toggling it on', () => {
    const page = TestBed.inject(PageScore);
    const score = scoreOf(false);
    page.register(score);
    page.silence();
    expect(score.isOn()).toBe(false);
  });

  it('keeps the next page score when the one before it leaves late', () => {
    const page = TestBed.inject(PageScore);
    const leaving = scoreOf(false);
    const arriving = scoreOf(true);
    page.register(leaving);
    page.register(arriving);
    page.unregister(leaving);
    expect(page.isOn()).toBe(true);
    page.unregister(arriving);
    expect(page.isOn()).toBe(false);
  });
});
