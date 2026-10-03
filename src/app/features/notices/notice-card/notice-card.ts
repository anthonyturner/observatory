import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Countdown } from '../../../core/notices/notice.types';
import { NoticeView } from '../notice-view';

/** One notice's words, links, close button and countdown line. */
@Component({
  selector: 'app-notice-card',
  imports: [RouterLink],
  templateUrl: './notice-card.html',
  styleUrl: './notice-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoticeCard {
  readonly notice = input.required<NoticeView>();
  readonly countdowns = input.required<ReadonlyMap<number, Countdown>>();
  readonly isPaused = input.required<boolean>();
  readonly isStill = input.required<boolean>();

  /** The close button was pressed. */
  readonly dismissed = output();
  /** One of its links was followed. */
  readonly followed = output();

  protected readonly countdown = computed(() => this.countdowns().get(this.notice().id) ?? null);
}
