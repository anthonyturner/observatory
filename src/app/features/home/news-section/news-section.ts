import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NEWS_STATE } from '../../../core/news/news-feed';
import { NewsItem, NewsState } from '../../../core/news/news.types';
import { Reader } from '../../../core/reader/reader-service';
import { ViewerSession } from '../../../core/session/viewer-session';
import { Clock } from '../../../core/time/clock';
import { ageOf } from '../../../core/usage/usage-format';
import { TopLink } from '../../../shared/section-jump/top-link';

/** What a column says in place of headlines, by where the news stands. */
const WAITING_MESSAGE: Record<Exclude<NewsState['status'], 'ready'>, string> = {
  reading: 'Reading the latest headlines…',
  unreachable: 'News out of reach: is the API running (npm start)?',
};

interface NewsColumn {
  readonly id: string;
  readonly title: string;
  readonly sub: string;
  readonly items: readonly NewsItem[];
}

const MINUTE_MS = 60_000;

/** Below the HUD, above the projects: the latest AI news, tools first, and the latest in software engineering. */
@Component({
  selector: 'app-news-section',
  imports: [TopLink],
  templateUrl: './news-section.html',
  styleUrl: './news-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsSection {
  private readonly state = inject(NEWS_STATE);
  private readonly reader = inject(Reader);
  private readonly session = inject(ViewerSession);
  private readonly clock = inject(Clock);
  /** Ages move a minute at a time, so the list is not redrawn every second. */
  private readonly minute = computed(() => Math.floor(this.clock.now().getTime() / MINUTE_MS));

  protected readonly waiting = computed(() => {
    const { status } = this.state();
    return status === 'ready' ? null : WAITING_MESSAGE[status];
  });

  protected readonly columns = computed((): readonly NewsColumn[] => {
    const state = this.state();
    const report = state.status === 'ready' ? state.report : null;
    return [
      { id: 'ai', title: 'AI news', sub: 'tools first', items: report?.ai ?? [] },
      {
        id: 'engineering',
        title: 'Software engineering',
        sub: 'latest',
        items: report?.engineering ?? [],
      },
    ];
  });

  protected readonly unread = computed(() => {
    const state = this.state();
    return state.status === 'ready' && state.report.unread.length
      ? `Not read this time: ${state.report.unread.join(', ')}.`
      : null;
  });

  /** "InfoQ · 3h", or the source alone for an undated headline. */
  protected sourceAndAge(item: NewsItem): string {
    return item.publishedAt
      ? `${item.source} · ${ageOf(item.publishedAt, this.minute() * MINUTE_MS)}`
      : item.source;
  }

  /** On this machine a plain click reads the story in the floating reader;
   *  Ctrl, ⌘, Shift or a middle click, and every click hosted, opens a tab. */
  protected readHere(event: MouseEvent, url: string): void {
    if (this.session.access() !== 'local') return;
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    void this.reader.open(url);
  }
}
