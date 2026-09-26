import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Skill } from '../data/skills';

/** One skill as an outlined tile naming its task, with an arrow. */
@Component({
  selector: 'app-skill-tile',
  templateUrl: './skill-tile.html',
  styleUrl: './skill-tile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkillTile {
  readonly skill = input.required<Skill>();
}
