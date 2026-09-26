import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CollisionCheck, PullCollision } from '../../../core/queue/collisions-report';

const KIND_LABEL: Record<PullCollision['kind'], string> = {
  conflict: 'Would conflict with',
  unchecked: 'Shares files, unchecked, with',
  clean: 'Shares files cleanly with',
};

const WHY_UNCHECKED: Record<Exclude<CollisionCheck, 'checked'>, string> = {
  'no-clone': 'No local clone of this repository was found, so shared files are not merged.',
  unreachable: 'The pull requests could not be fetched into the local clone.',
};

/** Files listed before the rest are summed up. */
const FILES_SHOWN = 3;

/** "src/a.ts, src/b.ts and 4 more". */
export function filesLine(files: readonly string[]): string {
  const shown = files.slice(0, FILES_SHOWN).join(', ');
  const more = files.length - FILES_SHOWN;
  return more > 0 ? `${shown} and ${more} more` : shown;
}

/** The pull requests one pull request shares files with, those it would conflict with first. */
@Component({
  selector: 'app-pull-collisions',
  templateUrl: './pull-collisions.html',
  styleUrl: './pull-collisions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PullCollisions {
  readonly collisions = input.required<readonly PullCollision[]>();
  readonly check = input.required<CollisionCheck>();
  /** Asks to open another pull request's panel. */
  readonly picked = output<number>();

  protected readonly rows = computed(() =>
    this.collisions().map((collision) => ({
      ...collision,
      label: KIND_LABEL[collision.kind],
      files: filesLine(collision.files),
    })),
  );
  protected readonly why = computed(() => {
    const check = this.check();
    return check === 'checked' ? null : WHY_UNCHECKED[check];
  });
}
