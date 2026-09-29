import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NewsVideo } from '../../../core/news/news.types';

/** The only players Home embeds, as the API rebuilds them from a video's id. */
const EMBEDDABLE =
  /^https:\/\/(www\.youtube-nocookie\.com\/embed\/[\w-]{11}|player\.vimeo\.com\/video\/\d{5,12})$/;

/** A story's video to play in place, or else its picture, full width; nothing when it has
 *  neither, or when what it has will not load. Nothing plays until it is asked to. */
@Component({
  selector: 'app-news-media',
  templateUrl: './news-media.html',
  styleUrl: './news-media.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsMedia {
  private readonly sanitizer = inject(DomSanitizer);

  readonly title = input.required<string>();
  readonly image = input<string | null>(null);
  readonly video = input<NewsVideo | null>(null);

  private readonly failed = signal<'video' | 'image' | null>(null);

  /** A player address the page trusts only after checking it against the two it embeds. */
  protected readonly embed = computed((): SafeResourceUrl | null => {
    const video = this.video();
    if (this.failed() || video?.kind !== 'embed' || !EMBEDDABLE.test(video.url)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(video.url);
  });
  protected readonly file = computed(() => {
    const video = this.video();
    return !this.failed() && video?.kind === 'file' && video.url.startsWith('https://')
      ? video.url
      : null;
  });
  protected readonly picture = computed(() =>
    this.failed() === 'image' || this.embed() || this.file() ? null : this.image(),
  );

  /** A video that will not play gives way to the picture; a picture that will not load, to nothing. */
  protected fail(what: 'video' | 'image'): void {
    this.failed.set(this.failed() === 'image' ? 'image' : what);
  }
}
