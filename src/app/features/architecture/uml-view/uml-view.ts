import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BOX_WIDTH, HEADER_HEIGHT, TOP, UmlDiagram } from '../../../core/architecture/uml-layout';

/** One class as a UML dependency diagram: what injects it, the class, and what it injects. */
@Component({
  selector: 'app-uml-view',
  templateUrl: './uml-view.html',
  styleUrl: './uml-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UmlView {
  readonly diagram = input.required<UmlDiagram>();
  /** The name of the class to put at the centre next. */
  readonly pick = output<string>();

  protected readonly boxWidth = BOX_WIDTH;
  protected readonly headerHeight = HEADER_HEIGHT;
  protected readonly captionY = TOP - 12;
}
