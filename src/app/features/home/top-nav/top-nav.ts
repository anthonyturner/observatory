import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The way to the orrery and the page's tools. */
@Component({
  selector: 'app-top-nav',
  templateUrl: './top-nav.html',
  styleUrl: './top-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopNav {}
