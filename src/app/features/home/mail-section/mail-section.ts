import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MailInbox } from '../../../core/mail/mail-inbox';
import { MailTabChoice } from '../../../core/mail/mail-tab-choice';
import { MAIL_ACCOUNTS } from '../../../core/mail/mail.types';
import { Clock } from '../../../core/time/clock';
import { ageOf } from '../../../core/usage/usage-format';
import { TopLink } from '../../../shared/section-jump/top-link';
import { TabStrip, tabStripTabId } from '../../../shared/tab-strip/tab-strip';
import { MAIL_ENV_FILE, mailPanel, mailSummary, mailTab, shownAccount } from './mail-view';

const MINUTE_MS = 60_000;
const TAB_STRIP = 'mail';
const PANEL_ID = 'mail-panel';

/** Below the HUD, above the news: the newest mail in each inbox, one tab each. Local only. */
@Component({
  selector: 'app-mail-section',
  imports: [TabStrip, TopLink],
  templateUrl: './mail-section.html',
  styleUrl: './mail-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MailSection {
  private readonly inbox = inject(MailInbox);
  private readonly tabChoice = inject(MailTabChoice);
  private readonly clock = inject(Clock);
  /** Ages move a minute at a time, so the list is not redrawn every second. */
  private readonly minute = computed(() => Math.floor(this.clock.now().getTime() / MINUTE_MS));

  protected readonly tabStrip = TAB_STRIP;
  protected readonly panelId = PANEL_ID;
  protected readonly envFile = MAIL_ENV_FILE;

  protected readonly tabs = computed(() =>
    MAIL_ACCOUNTS.map((account) => mailTab(this.inbox.states()[account])),
  );
  protected readonly selected = computed(() =>
    shownAccount(this.inbox.states(), this.tabChoice.chosen()),
  );
  protected readonly selectedTabId = computed(() => tabStripTabId(TAB_STRIP, this.selected()));
  private readonly selectedState = computed(() => this.inbox.states()[this.selected()]);
  protected readonly panel = computed(() => mailPanel(this.selectedState()));
  protected readonly summary = computed(() => mailSummary(this.inbox.states()));

  protected readonly isReading = this.inbox.isReading;
  /** Busy only until each inbox has had its first answer; a refresh changes the button alone. */
  protected readonly isFirstRead = computed(() =>
    MAIL_ACCOUNTS.some(
      (account) => this.inbox.states()[account].report === null && this.isReading(),
    ),
  );
  /** Nothing to read again with neither account set up. */
  protected readonly canRefresh = computed(() =>
    MAIL_ACCOUNTS.some((account) => this.inbox.states()[account].report?.state !== 'off'),
  );

  /** "2m ago": when the selected inbox was last checked; empty before it has been. */
  protected readonly checkedAgo = computed(() => {
    const report = this.selectedState().report;
    if (!report || report.state === 'off') return '';
    const age = ageOf(report.checkedAt, this.minute() * MINUTE_MS);
    return age === 'now' ? 'just now' : `${age} ago`;
  });

  /** Each row's age, beside the rows rather than in them, so a minute's tick rebuilds no row. */
  protected readonly rowAges = computed(() => {
    const panel = this.panel();
    const now = this.minute() * MINUTE_MS;
    return panel.kind === 'list'
      ? panel.rows.map((row) => (row.receivedAt ? ageOf(row.receivedAt, now) : ''))
      : [];
  });

  /** Said once after a Refresh the owner asked for; never on a minute's tick. */
  protected readonly announcement = signal('');

  protected select(account: string): void {
    const picked = MAIL_ACCOUNTS.find((each) => each === account);
    if (picked) this.tabChoice.choose(picked);
  }

  protected async refresh(): Promise<void> {
    this.announcement.set('');
    await this.inbox.refresh();
    this.announcement.set(`Mail read again: ${this.summary()}.`);
  }
}
