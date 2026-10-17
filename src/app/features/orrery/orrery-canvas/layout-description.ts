import { openTotal, OrreryWorld } from '../../../core/orrery/world-layout';

/** What the canvas says about its picture to someone who cannot see it. The sun's total
 *  is left out until there are worlds to count: "0" would be a reading, not a wait. */
export function describeLayout(worlds: readonly OrreryWorld[]): string {
  const where = 'Earth at the centre; the sun';
  if (worlds.length === 0) return `${where} at the upper left`;
  const open = openTotal(worlds);
  return `${where}, with ${open} open pull request${open === 1 ? '' : 's'}, at the upper left`;
}
