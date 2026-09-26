import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { countBarsOf } from '../../../core/projects/count-bars';
import { LitProject } from '../../../core/projects/lit-project';
import { ProjectJump } from '../../../core/projects/project-jump';
import { totalsOf } from '../../../core/projects/project-totals';
import { ProjectSnapshot } from '../../../core/projects/project.types';
import { severityOf } from '../../../core/projects/severity';

/** A part of a project's star map the card links to. */
interface StarMapPart {
  readonly label: string;
  readonly fragment?: string;
}

const STAR_MAP_PARTS: readonly StarMapPart[] = [
  { label: 'PRs' },
  { label: 'Issues', fragment: 'issues' },
  { label: 'Logs', fragment: 'logs' },
  { label: 'Usage', fragment: 'usage' },
];

let nextCardId = 0;
/** How long a card stays highlighted after a jump to it. */
const FLASH_MS = 1800;

/** One project: its worst problem as a colour, what is waiting, and the way in. */
@Component({
  selector: 'app-project-card',
  imports: [RouterLink],
  templateUrl: './project-card.html',
  styleUrl: './project-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--sev]': 'severity().color',
    '[class.flash]': 'isFlashing()',
    // Pointing at a card, or tabbing into it, lights its bead on the core.
    '(pointerenter)': 'light()',
    '(pointerleave)': 'unlightUnlessFocused($event)',
    '(focusin)': 'light()',
    '(focusout)': 'unlightUnlessFocusStays($event)',
  },
})
export class ProjectCard {
  readonly project = input.required<ProjectSnapshot>();

  protected readonly nameId = `project-card-${nextCardId++}`;
  protected readonly parts = STAR_MAP_PARTS;
  protected readonly severity = computed(() => severityOf(this.project()));
  protected readonly bars = computed(() => countBarsOf(this.project()));
  protected readonly totals = computed(() => totalsOf(this.project()));
  protected readonly gitHubUrl = computed(() => `https://github.com/${this.project().repo}`);

  private readonly lit = inject(LitProject);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly motion = inject(MotionPreference);
  private readonly projectJump = inject(ProjectJump);
  /** A card made after a jump (as the projects arrive) must not answer it late. */
  private handledJump = this.projectJump.request()?.id ?? 0;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly isFlashing = signal(false);

  constructor() {
    effect(() => {
      const request = this.projectJump.request();
      if (!request || request.id === this.handledJump) return;
      this.handledJump = request.id;
      if (request.key === untracked(this.project).repo) untracked(() => this.arrive());
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.flashTimer) clearTimeout(this.flashTimer);
    });
  }

  /** Scrolls the card into view, gives its name the focus, and lights it for a moment. */
  private arrive(): void {
    const card = this.host.nativeElement;
    card.scrollIntoView({ behavior: this.motion.isStill() ? 'auto' : 'smooth', block: 'center' });
    card.querySelector<HTMLElement>('.name a')?.focus({ preventScroll: true });
    this.isFlashing.set(true);
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.isFlashing.set(false), FLASH_MS);
  }

  protected light(): void {
    this.lit.light(this.project().repo);
  }

  protected unlightUnlessFocused(event: PointerEvent): void {
    const card = event.currentTarget;
    if (card instanceof Element && card.contains(this.document.activeElement)) return;
    this.lit.unlight(this.project().repo);
  }

  protected unlightUnlessFocusStays(event: FocusEvent): void {
    const card = event.currentTarget;
    if (
      card instanceof Element &&
      event.relatedTarget instanceof Node &&
      card.contains(event.relatedTarget)
    ) {
      return;
    }
    this.lit.unlight(this.project().repo);
  }
}
