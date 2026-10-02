import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { PlaylistPlayer } from '../../../core/playlist/playlist-player';
import { SoundPreference } from '../../../core/sound/sound-preference';
import { TrackList } from './track-list/track-list';

/** Home's playlist along the foot of the screen: the video, the transport and the
 *  volume, with the track list above. It plays instead of the generated score,
 *  never over it. */
@Component({
  selector: 'app-transport-bar',
  imports: [TrackList],
  providers: [PlaylistPlayer],
  templateUrl: './transport-bar.html',
  styleUrl: './transport-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'listOpen.set(false)' },
})
export class TransportBar {
  protected readonly player = inject(PlaylistPlayer);
  private readonly sound = inject(SoundPreference);
  private readonly screen = viewChild.required<ElementRef<HTMLElement>>('screen');

  protected readonly listOpen = signal(false);
  protected readonly hasStarted = computed(() => this.player.state() !== 'idle');
  protected readonly position = computed(
    () => `${this.player.index() + 1} / ${this.player.tracks.length}`,
  );
  protected readonly status = computed(() =>
    this.player.state() === 'loading' ? 'Loading…' : this.player.current().artist,
  );

  constructor() {
    afterNextRender(() => this.player.attach(this.screen().nativeElement));
    effect(() => {
      if (this.sound.isOn()) untracked(() => this.player.pause());
    });
  }

  protected toggle(): void {
    if (!this.player.isPlaying()) this.silenceScore();
    this.player.toggle();
  }

  protected next(): void {
    this.silenceScore();
    this.player.next();
  }

  protected previous(): void {
    this.silenceScore();
    this.player.previous();
  }

  protected pick(index: number): void {
    this.silenceScore();
    this.player.select(index);
    this.listOpen.set(false);
  }

  protected onVolume(event: Event): void {
    this.player.setVolume(Number((event.target as HTMLInputElement).value));
  }

  private silenceScore(): void {
    if (this.sound.isOn()) this.sound.toggle();
  }
}
