import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { landOnFragment } from './land-on-fragment';
import { SectionJump } from './section-jump';

const isShown = signal(false);

@Component({ template: '' })
class Page {
  constructor() {
    landOnFragment('mail', isShown);
  }
}

@Component({ template: '' })
class Elsewhere {}

async function arrive(url: string) {
  const land = vi.fn<(id: string) => void>();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', component: Page },
        { path: 'orrery', component: Elsewhere },
      ]),
      { provide: SectionJump, useValue: { land } },
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  const settle = async (): Promise<void> => {
    TestBed.tick();
    await harness.fixture.whenStable();
  };
  await settle();
  return { harness, land, settle };
}

describe('landOnFragment', () => {
  beforeEach(() => isShown.set(false));

  it('lands on the section an arriving link names, once the section is shown', async () => {
    const { harness, land, settle } = await arrive('/orrery');

    await harness.navigateByUrl('/#mail');
    await settle();
    expect(land).not.toHaveBeenCalled();

    isShown.set(true);
    await settle();
    expect(land).toHaveBeenCalledExactlyOnceWith('mail');
  });

  it('lands again when the link is followed while the address already names it', async () => {
    isShown.set(true);
    const { harness, land, settle } = await arrive('/#mail');
    expect(land).toHaveBeenCalledTimes(1);

    await harness.navigateByUrl('/#mail');
    await settle();

    expect(land).toHaveBeenCalledTimes(2);
  });

  it('stays where it is when the address names no section, or another', async () => {
    isShown.set(true);
    const { harness, land, settle } = await arrive('/');

    await harness.navigateByUrl('/#news');
    await settle();

    expect(land).not.toHaveBeenCalled();
  });
});

describe('SectionJump.land', () => {
  it('scrolls to the section and moves focus there', () => {
    const section = document.createElement('section');
    section.id = 'mail';
    section.tabIndex = -1;
    section.scrollIntoView = vi.fn();
    document.body.append(section);

    TestBed.inject(SectionJump).land('mail');

    expect(section.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(section);
    section.remove();
  });
});
