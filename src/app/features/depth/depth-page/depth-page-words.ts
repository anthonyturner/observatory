import { DepthState } from '../../../core/depth/depth-feed';
import { DepthReport } from '../../../core/depth/depth.types';
import { plural } from '../../../shared/text/plural';
import { PageMessage } from '../../releases/releases-page/releases-words';

/** What to say while there is no report to draw, or null once there is one. */
export function stateMessage(state: DepthState): PageMessage | null {
  switch (state.status) {
    case 'reading':
      return { headline: 'Reading the modules…' };
    case 'missing':
      return {
        headline: 'No clone of this project here',
        detail:
          'The Depth screen reads the code from a clone on this machine. Clone it beside Observatory, or list its folder in ~/.claude/observatory/clones.json.',
      };
    case 'unreachable':
      return {
        headline: 'Could not read the modules',
        detail: 'Is the API running (npm start)? Try again in a moment.',
      };
    case 'ready':
      return null;
  }
}

/** What to say in place of the sky when a ready report has nothing to draw. */
export function emptyMessage(report: DepthReport, shown: number): PageMessage | null {
  if (shown > 0) return null;
  return report.modules.length
    ? { headline: 'No module matches', detail: 'Try fewer words, or all verdicts.' }
    : { headline: 'No TypeScript modules', detail: 'Nothing in this clone exports code.' };
}

/** "me/app · 812 modules · scanned 14:02". */
export function depthStamp(repo: string, report: DepthReport | null): string {
  if (!report) return repo;
  const scanned = new Date(report.scannedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${repo} · ${plural(report.modules.length, 'module')} · scanned ${scanned}`;
}
