import { TokenDay } from '../../../../core/usage/usage-document';
import { barRowsChart } from './bar-rows-chart';
import { pastWeeksChart } from './past-weeks-chart';
import { tokenChart } from './token-chart';

const day = (key: string, families: Record<string, number>): TokenDay => ({
  day: key,
  families,
  cacheRead: 5_000,
  messages: 1_200,
  sessions: 3,
  toolCalls: 40,
  subagents: 2,
});

describe('pastWeeksChart', () => {
  it('draws each week as a bar as tall as its peak, labelled by its reset', () => {
    const chart = pastWeeksChart([{ resetsAt: '2026-09-25T19:00:00Z', peak: 53 }], 452, 'en-US');

    // Laid out for four weeks at least: a 100px band, a 46px bar in its middle.
    expect(chart.bars[0]).toMatchObject({ x: 67, width: 46 });
    expect(chart.bars[0].tip).toBe('Week to Sep 25\n53% used by its reset');
    expect(chart.values[0].text).toBe('53%');
    expect(chart.axis.map((text) => text.text)).toEqual(['0%', '100%', 'Sep 25']);
  });
});

describe('tokenChart', () => {
  const rows = [day('2026-09-25', { opus: 300, sonnet: 100 }), day('2026-09-26', {})];

  it('stacks each day by family, tallest day to the top', () => {
    const chart = tokenChart(rows, 460, 'en-US');

    expect(chart.segments.map((segment) => segment.colour)).toEqual([
      'var(--usage-opus)',
      'var(--usage-sonnet)',
    ]);
    // 164px of plot for 400 tokens; the upper segment gives 2px to the gap.
    expect(chart.segments[0]).toMatchObject({ y: 53, height: 123 });
    expect(chart.segments[1]).toMatchObject({ y: 12, height: 39 });
    expect(chart.axis.slice(0, 3).map((text) => text.text)).toEqual(['0', '200', '400']);
  });

  it('labels days back from today and says what each day held', () => {
    const chart = tokenChart(rows, 460, 'en-US');

    expect(chart.axis.slice(3).map((text) => text.text)).toEqual(['Sep 25', 'Sep 26']);
    expect(chart.hits[0].tip).toBe(
      'Sep 25\nOpus 300\nSonnet 100\ncache reads 5k\n1,200 replies · 3 sessions\n40 tool calls · 2 subagents',
    );
    expect(chart.hits[1].tip.split('\n')[1]).toBe('nothing used');
  });
});

describe('barRowsChart', () => {
  it('reaches the longest bar to the value column and keeps the others in proportion', () => {
    const chart = barRowsChart(
      [
        { label: 'rivals_pulse', value: 80, text: '80', tip: 'a', isStrong: true },
        {
          label: 'a-very-long-project-name-indeed',
          value: 20,
          text: '20',
          tip: 'b',
          isStrong: false,
        },
      ],
      500,
    );

    expect(chart.height).toBe(52);
    expect(chart.rows[0].bar).toEqual({ x: 170, y: 6, width: 274, height: 14 });
    expect(chart.rows[1].bar.width).toBe(68.5);
    expect(chart.rows[1].label.text).toBe('a-very-long-project-nam…');
    expect(chart.rows[1].isStrong).toBe(false);
    expect(chart.rows[0].value).toMatchObject({ x: 450, text: '80' });
  });
});
