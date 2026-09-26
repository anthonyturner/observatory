import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The text box and Send. Nothing is sent yet; that comes with the assistant. */
@Component({
  selector: 'app-ask-bar',
  templateUrl: './ask-bar.html',
  styleUrl: './ask-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AskBar {
  /** Keeps the form from reloading the page until there is somewhere to send it. */
  protected holdSubmission(event: Event): void {
    event.preventDefault();
  }
}
