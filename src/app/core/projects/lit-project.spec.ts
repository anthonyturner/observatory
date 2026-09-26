import { TestBed } from '@angular/core/testing';
import { LitProject } from './lit-project';

describe('LitProject', () => {
  it('lights one project at a time', () => {
    const lit = TestBed.inject(LitProject);
    lit.light('a/one');
    lit.light('a/two');
    expect(lit.key()).toBe('a/two');
  });

  it('ignores a late unlight of a project no longer lit', () => {
    const lit = TestBed.inject(LitProject);
    lit.light('a/one');
    lit.light('a/two');
    lit.unlight('a/one');
    expect(lit.key()).toBe('a/two');
    lit.unlight('a/two');
    expect(lit.key()).toBeNull();
  });
});
