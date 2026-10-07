import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DocBlock } from '../../../core/library/doc.types';
import { DocItem } from '../doc-item/doc-item';
import { DocSpans } from '../doc-spans/doc-spans';

/** Prefixes a heading's anchor in the page, so a page's headings cannot clash with the app's ids. */
export const HEADING_ID_PREFIX = 'doc-';

/** A Library page's blocks: headings, paragraphs, lists, quotes, code, tables and rules. */
@Component({
  selector: 'app-doc-blocks',
  imports: [DocSpans, DocItem],
  templateUrl: './doc-blocks.html',
  styleUrl: './doc-blocks.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocBlocks {
  readonly blocks = input.required<readonly DocBlock[]>();

  protected readonly idPrefix = HEADING_ID_PREFIX;
}
