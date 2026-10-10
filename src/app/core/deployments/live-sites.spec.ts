import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LiveSites, parseLiveSites } from './live-sites';

function setUp() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { sites: TestBed.inject(LiveSites), http: TestBed.inject(HttpTestingController) };
}

describe('parseLiveSites', () => {
  it('keys each web address by the lower-case repository', () => {
    const sites = parseLiveSites({
      generatedAt: 'x',
      sites: [{ repo: 'Me/App', url: 'https://app.example.com' }],
    });

    expect(sites.get('me/app')).toBe('https://app.example.com');
  });

  it('drops what is not a repository with a web address, and reads anything else as none', () => {
    const sites = parseLiveSites({
      sites: [
        { repo: 'me/script', url: 'javascript:alert(1)' },
        { repo: 'me/empty', url: '' },
        { url: 'https://nameless.example.com' },
        'me/app',
        null,
      ],
    });

    expect(sites.size).toBe(0);
    expect(parseLiveSites(null).size).toBe(0);
    expect(parseLiveSites({ sites: 'many' }).size).toBe(0);
  });
});

describe('LiveSites', () => {
  it('asks for nothing until a screen needs a site', () => {
    const { sites, http } = setUp();

    expect(sites.urlFor('me/app')).toBeNull();
    http.expectNone('/api/live-sites');
  });

  it('reads every project’s site in one request, however many screens ask', () => {
    const { sites, http } = setUp();

    sites.load();
    sites.load();
    http.expectOne('/api/live-sites').flush({
      sites: [{ repo: 'me/app', url: 'https://app.example.com' }],
    });
    sites.load();

    expect(sites.urlFor('me/app')).toBe('https://app.example.com');
    expect(sites.urlFor('ME/APP')).toBe('https://app.example.com');
    expect(sites.urlFor('me/other')).toBeNull();
    http.expectNone('/api/live-sites');
  });

  it('is read only once a read has ended, whether it worked or failed', () => {
    const { sites, http } = setUp();
    expect(sites.isRead()).toBe(false);

    sites.load();
    expect(sites.isRead()).toBe(false);
    http.expectOne('/api/live-sites').flush({ sites: [] });
    expect(sites.isRead()).toBe(true);
  });

  it('has no site for anyone when the read fails, and reads again for the next screen to ask', () => {
    const { sites, http } = setUp();
    sites.load();
    http.expectOne('/api/live-sites').flush('down', { status: 502, statusText: 'Bad Gateway' });

    expect(sites.urlFor('me/app')).toBeNull();
    expect(sites.isRead()).toBe(true);

    sites.load();
    http.expectOne('/api/live-sites').flush({
      sites: [{ repo: 'me/app', url: 'https://app.example.com' }],
    });
    expect(sites.urlFor('me/app')).toBe('https://app.example.com');
  });
});
