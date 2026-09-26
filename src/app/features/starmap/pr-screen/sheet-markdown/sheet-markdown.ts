import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { markdownBlocks } from '../../../../core/text/markdown';
import { MdSpans } from '../md-spans/md-spans';

/** A pull request's description, drawn as pr-starmap draws it and never as HTML. */
@Component({
  selector: 'app-sheet-markdown',
  imports: [MdSpans],
  templateUrl: './sheet-markdown.html',
  styleUrl: './sheet-markdown.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetMarkdown {
  readonly source = input.required<string>();

  protected readonly blocks = computed(() => markdownBlocks(this.source()));
}
