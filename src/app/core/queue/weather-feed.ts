import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, catchError, map, of } from 'rxjs';
import { WeatherByPull, parseWeatherReport } from './weather';

const WEATHER_URL = '/api/weather';
const NONE: WeatherByPull = new Map();

/**
 * Reads one repository's tactical weather: each open pull request's design red
 * flags. Until it arrives, or if it cannot be read, no pull request has any, so
 * the sky stays clear rather than guessing.
 */
@Injectable()
export class WeatherFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<WeatherByPull>(NONE);
  private repo: string | null = null;
  private reading: Subscription | null = null;

  readonly weather = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`'s weather, in place of any it was reading; another repository's is dropped at once. */
  load(repo: string): void {
    if (repo !== this.repo) this.current.set(NONE);
    this.repo = repo;
    this.reading?.unsubscribe();
    this.reading = this.http
      .get<unknown>(WEATHER_URL, { params: { repo } })
      .pipe(
        map(parseWeatherReport),
        map((report) => report && new Map(report.pulls.map((pull) => [pull.number, pull]))),
        catchError(() => of(null)),
      )
      .subscribe((weather) => {
        if (weather) this.current.set(weather);
      });
  }
}
