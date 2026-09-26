import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextHeadingId = 0;

/** A HUD section: a spaced-capitals heading with a rule running on, then
 *  whatever the section holds. */
@Component({
  selector: 'app-hud-section',
  templateUrl: './hud-section.html',
  styleUrl: './hud-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HudSection {
  readonly heading = input.required<string>();
  readonly note = input<string>();

  protected readonly headingId = `hud-section-${nextHeadingId++}`;
}
