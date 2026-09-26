import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DataAge } from '../../../core/projects/data-age';
import { FogVeil } from '../../../shared/night-sky/fog-veil';

/** The veil over the core and the sky as the projects report ages. */
@Component({
  selector: 'app-data-fog',
  imports: [FogVeil],
  template: '<app-fog-veil [level]="level()" />',
  styles: ':host { position: absolute; inset: 0; z-index: 1; pointer-events: none; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataFog {
  private readonly age = inject(DataAge);
  protected readonly level = computed(() => this.age.fog().level);
}
