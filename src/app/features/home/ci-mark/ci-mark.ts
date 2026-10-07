import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CiHealth } from '../../../core/actions/actions-report';
import { CiHealthFeed } from '../../../core/actions/ci-health-feed';
import { ACTIONS_TAB, projectTabLink } from '../../../shared/project-tabs/project-tabs';
import { ciHealthWords } from '../../actions/actions-words';

export interface CiMarkView {
  readonly link: string;
  /** The dot's colour, as CSS. */
  readonly colour: string;
  /** What hover and a screen reader say. */
  readonly spoken: string;
}

/** The mark for a project's default-branch CI; grey and unknown until it has been read. */
export function ciMarkOf(repo: string, name: string, health: CiHealth | null): CiMarkView {
  const link = projectTabLink(repo, ACTIONS_TAB);
  if (!health) {
    return { link, colour: 'var(--ci-none)', spoken: `${name}: Actions, CI not read yet` };
  }
  return {
    link,
    colour: `var(--ci-${health.state})`,
    spoken: `${name}: Actions, CI on ${ciHealthWords(health)}`,
  };
}

/** A project card's way to its Actions screen, its dot saying how the default branch's CI stands. */
@Component({
  selector: 'app-ci-mark',
  imports: [RouterLink],
  templateUrl: './ci-mark.html',
  styleUrl: './ci-mark.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CiMark {
  /** `owner/name`. */
  readonly repo = input.required<string>();
  /** The project's name, for what a screen reader says. */
  readonly name = input.required<string>();

  private readonly feed = inject(CiHealthFeed);
  protected readonly view = computed(() =>
    ciMarkOf(this.repo(), this.name(), this.feed.health().get(this.repo()) ?? null),
  );

  constructor() {
    effect(() => {
      const repo = this.repo();
      untracked(() => this.feed.request(repo));
    });
  }
}
