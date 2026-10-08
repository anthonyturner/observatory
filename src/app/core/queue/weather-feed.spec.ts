import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WeatherFeed } from './weather-feed';

function setUp() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), WeatherFeed],
  });
  return { feed: TestBed.inject(WeatherFeed), http: TestBed.inject(HttpTestingController) };
}

const report = (repo: string, number: number) => ({
  repo,
  hidden: false,
  pulls: [{ number, headSha: 'abc', scanned: true, flags: [] }],
});

describe('WeatherFeed', () => {
  it('keys each pull request’s weather by its number', () => {
    const { feed, http } = setUp();

    feed.load('me/app');
    http.expectOne('/api/weather?repo=me/app').flush(report('me/app', 7));

    expect(feed.weather().get(7)?.scanned).toBe(true);
  });

  it('drops another repository’s weather at once, and keeps the last on a failed read', () => {
    const { feed, http } = setUp();
    feed.load('me/app');
    http.expectOne('/api/weather?repo=me/app').flush(report('me/app', 7));

    feed.load('me/app');
    http.expectOne('/api/weather?repo=me/app').flush('down', { status: 502, statusText: 'Bad' });
    expect(feed.weather().has(7)).toBe(true);

    feed.load('me/other');
    expect(feed.weather().size).toBe(0);
    http.expectOne('/api/weather?repo=me/other').flush(report('me/other', 9));
    expect([...feed.weather().keys()]).toEqual([9]);
  });
});
