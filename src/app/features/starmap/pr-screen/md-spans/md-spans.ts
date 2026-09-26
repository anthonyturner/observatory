import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Span } from '../../../../core/text/markdown';

/** One line's inline markdown: text, code, and links out, bold where it was. */
@Component({
  selector: 'app-md-spans',
  templateUrl: './md-spans.html',
  styleUrl: './md-spans.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MdSpans {
  readonly spans = input.required<readonly Span[]>();
}
