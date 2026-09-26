import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CoreStateFeed } from './core-state-feed';
import { CORE_STATE_SOURCES } from './core-state-tokens';
import { CoreStateSource } from './core-state.types';

describe('CoreStateFeed', () => {
  it('connects every source it is given', () => {
    const run: CoreStateSource = { connect: vi.fn() };

    @Component({ template: '', hostDirectives: [CoreStateFeed] })
    class Host {}
    TestBed.overrideDirective(CoreStateFeed, {
      set: { providers: [{ provide: CORE_STATE_SOURCES, useValue: run, multi: true }] },
    });
    TestBed.createComponent(Host);

    expect(run.connect).toHaveBeenCalledTimes(1);
  });
});
