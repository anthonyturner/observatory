import { plural } from '../../shared/text/plural';
import { ProjectSnapshot } from './project.types';

/** The card's foot line, as parts that each wrap whole: open PRs, issues,
 *  and how long the oldest has sat untouched. */
export function totalsOf({ open, issues, oldestIdleDays }: ProjectSnapshot): string[] {
  const totals = [plural(open, 'open PR')];
  if (issues !== undefined) totals.push(plural(issues, 'issue'));
  if (open > 0 && oldestIdleDays) totals.push(`oldest untouched ${oldestIdleDays} d`);
  return totals;
}
