import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, InjectionToken, Signal, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { parseReadAnswer } from './reader-parse';
import { ReadablePage, ReaderState } from './reader.types';

/** Fetches a page's readable content through Observatory's own API: the
 *  page cannot reach other sites itself. */
export type PageReader = (url: string) => Promise<ReadablePage | { failed: string }>;

const READ_URL = '/api/read';
const OUT_OF_REACH = 'the reader is not on this site (it runs on your own machine)';
const UNREADABLE = 'the reader did not understand the answer';

export const PAGE_READER = new InjectionToken<PageReader>('PAGE_READER', {
  providedIn: 'root',
  factory: () => {
    const http = inject(HttpClient);
    return async (url) => {
      try {
        const body = await firstValueFrom(http.get<unknown>(READ_URL, { params: { url } }));
        return parseReadAnswer(body) ?? { failed: UNREADABLE };
      } catch (error: unknown) {
        if (error instanceof HttpErrorResponse) return { failed: OUT_OF_REACH };
        throw error;
      }
    };
  },
});

/** The floating reader window's page: which one is open, and whether it has
 *  arrived. Opening another page replaces it; a late answer for a page no
 *  longer asked for is dropped. */
@Injectable({ providedIn: 'root' })
export class Reader {
  private readonly read = inject(PAGE_READER);
  private readonly current = signal<ReaderState>({ status: 'closed' });

  readonly state: Signal<ReaderState> = this.current.asReadonly();

  async open(url: string): Promise<void> {
    this.current.set({ status: 'loading', url });
    const answer = await this.read(url);
    const now = this.current();
    if (now.status !== 'loading' || now.url !== url) return;
    this.current.set(
      'failed' in answer
        ? { status: 'failed', url, failed: answer.failed }
        : { status: 'ready', url, page: answer },
    );
  }

  close(): void {
    this.current.set({ status: 'closed' });
  }
}
