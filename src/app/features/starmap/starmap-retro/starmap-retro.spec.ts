import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AgentsFeed } from '../../../core/agents/agents-report';
import { HistoryFeed } from '../../../core/queue/history-feed';
import { LedgerFeed } from '../../../core/queue/ledger-feed';
import { ELEMENT_WIDTH } from '../../../shared/element-width/element-width';
import { StarmapRetro } from './starmap-retro';

const READ_AT = '2026-10-06T12:00:00Z';
const hoursBefore = (hours: number): string =>
  new Date(Date.parse(READ_AT) - hours * 3_600_000).toISOString();

describe('StarmapRetro', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        LedgerFeed,
        HistoryFeed,
        AgentsFeed,
        { provide: ELEMENT_WIDTH, useValue: () => of(600) },
      ],
    });
    const fixture = TestBed.createComponent(StarmapRetro);
    fixture.detectChanges();
    return {
      fixture,
      http: TestBed.inject(HttpTestingController),
      host: fixture.nativeElement as HTMLElement,
    };
  }

  it('waits for the ledger, then draws where the week’s work waited, its cycle time and its agents', async () => {
    const { fixture, http, host } = setUp();
    expect(host.textContent).toContain('No merged or closed pull requests read yet');

    TestBed.inject(LedgerFeed).load('me/app');
    TestBed.inject(HistoryFeed).load('me/app');
    TestBed.inject(AgentsFeed).load('me/app');
    http.expectOne('/api/ledger?repo=me/app').flush({
      generatedAt: READ_AT,
      rows: [],
      titles: {},
      finished: [
        { number: 4, openedAt: hoursBefore(10), finishedAt: hoursBefore(4), fate: 'merged' },
      ],
    });
    http.expectOne('/api/history?repo=me/app').flush({
      frames: [
        { at: hoursBefore(8), items: [{ number: 4, bucket: 'failing' }], departed: [] },
        { at: hoursBefore(6), items: [], departed: [] },
      ],
    });
    http.expectOne('/api/agents?repo=me/app').flush({
      since: null,
      attributed: 1,
      agents: [{ agent: 'builder', prs: [4] }],
    });
    await fixture.whenStable();

    const headings = Array.from(host.querySelectorAll('h3')).map((h) => h.firstChild?.textContent);
    expect(headings.map((text) => text?.trim())).toEqual([
      'Where they waited',
      'Cycle time',
      'By agent',
    ]);
    expect(host.textContent).toContain('1 of the 1 pull request finished this week');
    expect(host.querySelector('[data-tip^="Checks failing"]')?.getAttribute('data-tip')).toBe(
      'Checks failing\n2.0 h across 1 pull request',
    );
    expect(host.querySelector('[data-tip^="builder"]')).not.toBeNull();
  });
});
