import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The night behind every page: fixed, decorative, and never takes a pointer. */
@Component({
  selector: 'app-sky-backdrop',
  template: '',
  styleUrl: './sky-backdrop.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class SkyBackdrop {}
