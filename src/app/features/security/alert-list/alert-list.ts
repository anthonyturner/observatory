import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SecurityAlert } from '../../../core/security/security-report';
import { SEVERITY_WORDS, alertMeta, severityColour } from '../security-words';

interface AlertRow {
  readonly key: string;
  readonly title: string;
  readonly severity: string;
  /** Its dot, coloured as the sky colours its mark: a CSS colour. */
  readonly colour: string;
  readonly where: string;
  /** "Dependabot #8 · opened 3d ago". */
  readonly meta: string;
  readonly url: string;
}

const alertKey = (alert: SecurityAlert): string => `${alert.kind}-${alert.number}`;

/** The alerts as rows, in the report's order, `now` being when the report was made. */
function alertRows(alerts: readonly SecurityAlert[], now: number): AlertRow[] {
  return alerts.map((alert) => ({
    key: alertKey(alert),
    title: alert.title,
    severity: SEVERITY_WORDS[alert.severity],
    colour: severityColour(alert.severity),
    where: alert.where,
    meta: alertMeta(alert.kind, alert.number, alert.createdAt, now),
    url: alert.url,
  }));
}

/** The open alerts as a triage list, most severe first, each opening on GitHub. */
@Component({
  selector: 'app-alert-list',
  templateUrl: './alert-list.html',
  styleUrl: './alert-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertList {
  readonly alerts = input.required<readonly SecurityAlert[]>();
  readonly now = input.required<number>();

  protected readonly rows = computed(() => alertRows(this.alerts(), this.now()));
}
