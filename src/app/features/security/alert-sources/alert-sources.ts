import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  AlertSource,
  SEVERITIES,
  SourceStatus,
  countsTotal,
} from '../../../core/security/security-report';
import { KIND_WORDS, SEVERITY_WORDS, severityColour } from '../security-words';

export interface SourceCount {
  readonly key: string;
  /** "2 critical". */
  readonly words: string;
  readonly colour: string;
}

export interface SourceView {
  readonly key: string;
  readonly name: string;
  readonly status: SourceStatus;
  /** Its open alerts by grade, worst first; none when it has none or was not read. */
  readonly counts: readonly SourceCount[];
  /** "None open", or why it could not be read. */
  readonly note: string | null;
}

export function sourceView(source: AlertSource): SourceView {
  const counts = SEVERITIES.filter((severity) => source.counts[severity] > 0).map((severity) => ({
    key: severity,
    words: `${source.counts[severity]} ${SEVERITY_WORDS[severity].toLowerCase()}`,
    colour: severityColour(severity),
  }));
  const isEmpty = source.status === 'read' && countsTotal(source.counts) === 0;
  return {
    key: source.kind,
    name: KIND_WORDS[source.kind],
    status: source.status,
    counts,
    note: isEmpty ? 'None open' : source.note,
  };
}

/** Each of the three lists: how many it holds by grade, or a plain note on why it could not be read. */
@Component({
  selector: 'app-alert-sources',
  templateUrl: './alert-sources.html',
  styleUrl: './alert-sources.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertSources {
  readonly sources = input.required<readonly AlertSource[]>();

  protected readonly views = computed(() => this.sources().map(sourceView));
}
