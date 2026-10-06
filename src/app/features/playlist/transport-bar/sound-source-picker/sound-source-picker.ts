import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  SoundMenuGroup,
  SoundSelection,
} from '../../../../core/music-sync/sources/sound-source-choice';

interface OptionRow {
  readonly id: string;
  readonly label: string;
  readonly isSelected: boolean;
}

interface GroupRow {
  readonly id: string;
  readonly name: string;
  /** Headed by the source's name, unless its one entry already says it. */
  readonly isGrouped: boolean;
  readonly options: readonly OptionRow[];
}

/** Where Sync hears the music, as the arrow beside it: each source the browser can
 *  use, the one in use selected, and a mark when the one picked before is gone;
 *  picking one reports its entry's id. */
@Component({
  selector: 'app-sound-source-picker',
  templateUrl: './sound-source-picker.html',
  styleUrl: './sound-source-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoundSourcePicker {
  readonly menu = input.required<readonly SoundMenuGroup[]>();
  readonly selected = input.required<SoundSelection | null>();
  /** Held while the browser is asking, so the answer lands on the source it asked for. */
  readonly isBusy = input.required<boolean>();
  readonly picked = output<string>();

  protected readonly groups = computed((): GroupRow[] => {
    const selectedId = this.selected()?.option.id;
    return this.menu().map(({ source, options }) => ({
      id: source.id,
      name: source.name,
      isGrouped: options.length > 1 || options[0]?.label !== source.name,
      options: options.map(({ id, label }) => ({ id, label, isSelected: id === selectedId })),
    }));
  });

  protected readonly isPickGone = computed(() => this.selected()?.isPickGone ?? false);
  protected readonly hint = computed(() => {
    const selected = this.selected();
    if (!selected) return '';
    const gone = selected.isPickGone
      ? `The ${selected.source.name.toLowerCase()} picked before is not connected. `
      : '';
    return `${gone}Sync hears: ${selected.option.label}. Pick where it hears the music`;
  });

  protected onChange(event: Event): void {
    this.picked.emit((event.target as HTMLSelectElement).value);
  }
}
