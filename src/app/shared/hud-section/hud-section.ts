import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type HeadingLevel = 2 | 3;

let nextHeadingId = 0;

/** A HUD section: a spaced-capitals heading, with a rule running on unless
 *  it sits in a frame of its own, then whatever the section holds. */
@Component({
  selector: 'app-hud-section',
  imports: [NgTemplateOutlet],
  templateUrl: './hud-section.html',
  styleUrl: './hud-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HudSection {
  readonly heading = input.required<string>();
  readonly note = input<string>();
  readonly level = input<HeadingLevel>(2);
  readonly ruled = input(true);

  protected readonly headingId = `hud-section-${nextHeadingId++}`;
}
