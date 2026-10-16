import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NavSection } from './nav-section';

/** A section's name with its count and quiet state, as the eye sees them and as a screen reader hears them. */
@Component({
  selector: 'app-section-label',
  template: `{{ section().label }}
    @if (section().badge; as badge) {
      <span class="badge" aria-hidden="true">{{ badge.shown }}</span
      ><span class="visually-hidden">, {{ badge.spoken }}</span>
    }
    @if (section().isQuiet) {
      <span class="visually-hidden">, nothing here yet</span>
    }`,
  styleUrl: './section-label.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionLabel {
  readonly section = input.required<NavSection>();
}
