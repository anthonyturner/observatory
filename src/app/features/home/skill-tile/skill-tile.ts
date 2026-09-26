import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { Skill } from '../../../core/assistant/assistant.types';

/** One skill as an outlined tile naming its task, with an arrow. A press
 *  proposes the task; it says Proposing… until the reply is back. */
@Component({
  selector: 'app-skill-tile',
  templateUrl: './skill-tile.html',
  styleUrl: './skill-tile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkillTile {
  readonly skill = input.required<Skill>();
  readonly isProposing = input(false);
  readonly pressed = output<Skill>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  hasFocus(): boolean {
    return this.host.nativeElement.contains(this.document.activeElement);
  }

  focus(): void {
    this.host.nativeElement.querySelector('button')?.focus();
  }
}
