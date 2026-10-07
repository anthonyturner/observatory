import { ChangeDetectionStrategy, Component } from '@angular/core';

/** What the hosted site says in place of agents: only the owner's machine has them. */
@Component({
  selector: 'app-local-only-note',
  template: `<p class="note">
    Agents show only on your own machine. Observatory's API reads them from Claude Code's files
    there while it runs (<code>npm start</code>).
  </p>`,
  styleUrl: './local-only-note.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocalOnlyNote {}
