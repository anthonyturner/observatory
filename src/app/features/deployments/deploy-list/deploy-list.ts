import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DeployEnvironment } from '../../../core/deployments/deployments-report';
import { environmentSections } from './deploy-rows';

/** The same deployments as the sky, as a list for the keyboard and a screen reader. */
@Component({
  selector: 'app-deploy-list',
  templateUrl: './deploy-list.html',
  styleUrl: './deploy-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeployList {
  /** Production first, each with its deployments newest first. */
  readonly environments = input.required<readonly DeployEnvironment[]>();
  /** When the report was made, which ages are counted from. */
  readonly now = input.required<number>();

  protected readonly sections = computed(() =>
    environmentSections(this.environments(), this.now()),
  );
}
