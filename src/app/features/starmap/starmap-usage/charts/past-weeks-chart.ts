import { PastWeek } from '../../../../core/usage/usage-document';
import { dayText, percentText } from '../usage-text';
import { ColumnScale, ColumnsChart, columnsChart } from './columns-chart';

const PERCENT_SCALE: ColumnScale = { top: 100, bottomLabel: '0%', topLabel: '100%' };

/** Each earlier week as a bar, as far as it got before its reset. */
export function pastWeeksChart(
  weeks: readonly PastWeek[],
  width: number,
  locale?: string,
): ColumnsChart {
  const columns = weeks.map((week) => {
    const day = dayText(week.resetsAt, locale);
    return {
      label: day,
      value: week.peak,
      text: percentText(week.peak),
      tip: `Week to ${day}\n${percentText(week.peak)} used by its reset`,
    };
  });
  return columnsChart(columns, width, PERCENT_SCALE);
}
