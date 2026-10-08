import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PrincipleOfDay } from '../../../core/principles/principle-of-day';
import { HudSection } from '../../../shared/hud-section/hud-section';

/** Today's software-design principle on Home, with a question to sit with,
 *  and buttons to step through the others. Nothing shows until it is read. */
@Component({
  selector: 'app-principle-card',
  imports: [HudSection],
  templateUrl: './principle-card.html',
  styleUrl: './principle-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrincipleCard {
  protected readonly principles = inject(PrincipleOfDay);

  protected readonly note = computed(() => {
    const shown = this.principles.shown();
    if (!shown) return '';
    const place = `${shown.place} of ${shown.count}`;
    return shown.isToday ? `today · ${place}` : place;
  });
}
