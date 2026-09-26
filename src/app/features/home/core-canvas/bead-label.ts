import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LIT_BEAD_GROWTH } from '../../../core/instrument/beads';
import { CoreGeometry } from '../../../core/instrument/core-geometry';
import { LitProject } from '../../../core/projects/lit-project';

/** The reticle sits just outside the lit bead. */
const RETICLE_REACH = 1.9;
const RETICLE_MARGIN_PX = 7;
/** The label sits this far beyond the bead, on the side away from the core. */
const LABEL_GAP_PX = 16;
const LABEL_REACH = 3;

/** The lit project's bead named on the ring: a reticle round it and a label
 *  with its name and state beside it, on the side away from the core. */
@Component({
  selector: 'app-bead-label',
  template: `@if (label(); as l) {
    <span
      class="reticle"
      [style.left.px]="l.x"
      [style.top.px]="l.y"
      [style.--reticle.px]="l.reticle"
      [style.--sev]="l.colour"
    ></span>
    <span
      class="label"
      [class.left]="l.isLeft"
      [style.left.px]="l.labelX"
      [style.top.px]="l.y"
      [style.--sev]="l.colour"
    >
      <span class="name">{{ l.name }}</span>
      <span class="said">{{ l.said }}</span>
    </span>
  }`,
  styleUrl: './bead-label.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BeadLabel {
  private readonly geometry = inject(CoreGeometry);
  private readonly lit = inject(LitProject);

  protected readonly label = computed(() => {
    const key = this.lit.key();
    const view = this.geometry.view();
    const placed = this.geometry.placed().find((one) => one.bead.key === key);
    if (!key || !view || !placed) return null;
    const { bead } = placed;
    const project = bead.project;
    const isLeft = placed.x < view.centreX;
    const offset = placed.radius * LABEL_REACH + LABEL_GAP_PX;
    return {
      x: placed.x,
      y: placed.y,
      reticle: placed.radius * LIT_BEAD_GROWTH * RETICLE_REACH + RETICLE_MARGIN_PX,
      colour: bead.severity.color,
      isLeft,
      labelX: isLeft ? placed.x - offset : placed.x + offset,
      name: project.name,
      said: project.error ? 'unreadable' : `${bead.severity.word} · ${project.open} open`,
    };
  });
}
