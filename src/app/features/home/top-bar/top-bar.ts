import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ClockReadout } from '../clock-readout/clock-readout';
import { HOME_SUMMARY } from '../data/home-summary-source';
import { StatusLine } from '../status-line/status-line';
import { TopNav } from '../top-nav/top-nav';

/** The HUD's top row: the name and refresh stamp, the tools and status, the
 *  clock. */
@Component({
  selector: 'app-top-bar',
  imports: [TopNav, StatusLine, ClockReadout],
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBar {
  protected readonly summary = inject(HOME_SUMMARY);
}
