import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SITE_OPENER } from './site-opener';

function openerWith(open: (url: string, target: string) => unknown) {
  TestBed.configureTestingModule({
    providers: [{ provide: DOCUMENT, useValue: { defaultView: { open } } }],
  });
  return TestBed.inject(SITE_OPENER);
}

describe('SITE_OPENER', () => {
  it('opens the site in a new tab and cuts the tab off from Observatory', () => {
    const tab = { opener: 'observatory' as unknown };
    const requests: string[][] = [];
    const opener = openerWith((url, target) => {
      requests.push([url, target]);
      return tab;
    });

    expect(opener.open('http://localhost:5173/')).toBe(true);

    expect(requests).toEqual([['http://localhost:5173/', '_blank']]);
    expect(tab.opener).toBeNull();
  });

  it('says so when the browser blocks the tab', () => {
    expect(openerWith(() => null).open('http://localhost:5173/')).toBe(false);
  });
});
