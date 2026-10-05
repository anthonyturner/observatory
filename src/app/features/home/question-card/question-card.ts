import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { OpenKind } from '../../../core/assistant/open-items';
import { AskedQuestion, TIMED_OUT_NOTE } from '../../../core/assistant/open-question';

const KIND_NAMES: Readonly<Record<OpenKind, string>> = { pull: 'Pull request', issue: 'Issue' };

interface QuestionRow {
  readonly key: string;
  readonly kindName: string;
  readonly where: string;
  readonly title: string;
  readonly href: string;
  readonly openLabel: string;
}

let nextTitleId = 0;

/** Jev's offer to open what he just announced: a row and an Open button for
 *  each item, and No thanks. It never takes the focus, since nobody asked for
 *  it and the owner may be typing. */
@Component({
  selector: 'app-question-card',
  templateUrl: './question-card.html',
  styleUrl: './question-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'region', '[attr.aria-labelledby]': 'titleId' },
})
export class QuestionCard {
  readonly question = input.required<AskedQuestion>();
  /** The item's address on its star map. */
  readonly opened = output<string>();
  readonly dismissed = output<void>();

  protected readonly titleId = `question-title-${nextTitleId++}`;
  protected readonly timedOutNote = TIMED_OUT_NOTE;
  protected readonly rows = computed(() =>
    this.question().items.map(
      ({ kind, repo, label, number, title, href }): QuestionRow => ({
        key: `${kind}:${repo}#${number}`,
        kindName: KIND_NAMES[kind],
        where: `${label} #${number}`,
        title,
        href,
        openLabel: `Open ${KIND_NAMES[kind].toLowerCase()} ${number} in ${label}: ${title}`,
      }),
    ),
  );
}
