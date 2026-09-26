import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ViewerSession } from '../../core/session/viewer-session';

/** Tells a visitor the hosted site is a read-only preview, with the way in for its owner. */
@Component({
  selector: 'app-preview-banner',
  template: `
    @if (session.isVisitor()) {
      <a class="preview" [href]="session.signInUrl()">Preview · read-only · <b>Sign in</b></a>
    }
  `,
  styleUrl: './preview-banner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewBanner {
  protected readonly session = inject(ViewerSession);
}
