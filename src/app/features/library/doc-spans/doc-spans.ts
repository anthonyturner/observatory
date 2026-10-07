import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocSpan } from '../../../core/library/doc.types';

/** A Library page's inline text: emphasis, code, links within the Library and out, and images. */
@Component({
  selector: 'app-doc-spans',
  imports: [RouterLink],
  templateUrl: './doc-spans.html',
  styleUrl: './doc-spans.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocSpans {
  readonly spans = input.required<readonly DocSpan[]>();
}
