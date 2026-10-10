import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BOX_WIDTH, HEADER_HEIGHT, TOP, UmlDiagram } from '../../../core/architecture/uml-layout';

/** One node as a UML dependency diagram: what depends on it, the node, and what it depends on. */
@Component({
  selector: 'app-uml-view',
  templateUrl: './uml-view.html',
  styleUrl: './uml-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UmlView {
  readonly diagram = input.required<UmlDiagram>();
  /** The id of the node to put at the centre next. */
  readonly pick = output<string>();

  protected readonly boxWidth = BOX_WIDTH;
  protected readonly headerHeight = HEADER_HEIGHT;
  protected readonly captionY = TOP - 12;
  /** Stops short of the frame's rounded corners. */
  protected readonly accentHeight = HEADER_HEIGHT - 20;
}
