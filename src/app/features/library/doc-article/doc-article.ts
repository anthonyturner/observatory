import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocBlocks } from '../doc-blocks/doc-blocks';
import { ArticleView, Neighbours } from '../library-page/library-view';

/** One Library page to read: its title, its headings to jump to, its text, and the pages either side. */
@Component({
  selector: 'app-doc-article',
  imports: [RouterLink, DocBlocks],
  templateUrl: './doc-article.html',
  styleUrl: './doc-article.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocArticle {
  readonly article = input.required<ArticleView>();
  readonly neighbours = input.required<Neighbours>();
}
