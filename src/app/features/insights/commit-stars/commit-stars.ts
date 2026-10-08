import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommitWeek } from '../../../core/insights/insights-report';
import { commitStars } from './commit-stars-layout';

/** The header's constellation: a star a week, sized by its commits. The Commits
 *  section's chart and table carry the same numbers for a keyboard or screen reader. */
@Component({
  selector: 'app-commit-stars',
  template: `@let s = strip();
    <svg
      [attr.width]="s.width"
      [attr.height]="s.height"
      [attr.viewBox]="'0 0 ' + s.width + ' ' + s.height"
      aria-hidden="true"
    >
      <polyline class="line" [attr.points]="s.line" />
      @for (star of s.stars; track star.key) {
        <circle
          class="star"
          [class.dark]="star.isDark"
          [attr.cx]="star.x"
          [attr.cy]="star.y"
          [attr.r]="star.r"
        />
      }
    </svg>`,
  styleUrl: './commit-stars.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommitStars {
  readonly weeks = input.required<readonly CommitWeek[]>();

  protected readonly strip = computed(() => commitStars(this.weeks()));
}
