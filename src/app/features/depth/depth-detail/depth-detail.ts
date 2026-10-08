import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DepthModule, DepthPrinciple } from '../../../core/depth/depth.types';
import { depthText, pathParts, verdictWord } from '../../../core/depth/depth-words';

/** The module under the pointer or the focus: its three numbers and the idea its verdict points at. */
@Component({
  selector: 'app-depth-detail',
  templateUrl: './depth-detail.html',
  styleUrl: './depth-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepthDetail {
  readonly module = input.required<DepthModule>();
  /** Null when the report did not carry the idea. */
  readonly principle = input.required<DepthPrinciple | null>();

  protected readonly path = computed(() => pathParts(this.module()));
  protected readonly verdict = computed(() => verdictWord(this.module().verdict));
  protected readonly depth = computed(() => depthText(this.module().depth));
}
