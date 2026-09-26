import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PreviewBanner } from './shared/preview-banner/preview-banner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PreviewBanner],
  template: '<router-outlet /><app-preview-banner />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
