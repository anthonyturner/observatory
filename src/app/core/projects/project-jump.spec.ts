import { TestBed } from '@angular/core/testing';
import { ProjectJump } from './project-jump';

describe('ProjectJump', () => {
  it('makes every jump a new request, even to the same project', () => {
    const jump = TestBed.inject(ProjectJump);
    expect(jump.request()).toBeNull();
    jump.jumpTo('o/a');
    const first = jump.request();
    jump.jumpTo('o/a');
    expect(jump.request()?.key).toBe('o/a');
    expect(jump.request()?.id).not.toBe(first?.id);
  });
});
