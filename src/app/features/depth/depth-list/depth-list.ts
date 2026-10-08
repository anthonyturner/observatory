import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { shallowestFirst } from '../../../core/depth/depth-modules';
import { DepthModule } from '../../../core/depth/depth.types';
import { numbersLine, pathParts } from '../../../core/depth/depth-words';

interface Row {
  readonly module: DepthModule;
  readonly name: string;
  readonly folder: string;
  readonly numbers: string;
}

/** The modules as a list, shallowest first: the same data as the sky, reached by Tab. */
@Component({
  selector: 'app-depth-list',
  templateUrl: './depth-list.html',
  styleUrl: './depth-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepthList {
  readonly modules = input.required<readonly DepthModule[]>();
  /** The file of the module the screen is showing. */
  readonly active = input<string | null>(null);
  readonly activate = output<DepthModule>();

  protected readonly rows = computed((): readonly Row[] =>
    shallowestFirst(this.modules()).map((module) => ({
      module,
      ...pathParts(module),
      numbers: numbersLine(module),
    })),
  );
}
