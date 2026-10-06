import { columnsChart } from './columns-chart';

const columns = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    label: `W${index + 1}`,
    value: index,
    text: `${index} h`,
    tip: `week ${index + 1}`,
  }));
const SCALE = { top: 10, bottomLabel: '0', topLabel: '10 h' };

describe('columnsChart', () => {
  it('labels and values every column when there is room', () => {
    const chart = columnsChart(columns(4), 600, SCALE);

    expect(chart.axis.slice(2).map((text) => text.text)).toEqual(['W1', 'W2', 'W3', 'W4']);
    expect(chart.values.map((text) => text.text)).toEqual(['0 h', '1 h', '2 h', '3 h']);
  });

  it('labels every other column on a narrow chart, counting back from the newest', () => {
    const chart = columnsChart(columns(8), 280, SCALE);

    expect(chart.bars.length).toBe(8);
    expect(chart.axis.slice(2).map((text) => text.text)).toEqual(['W2', 'W4', 'W6', 'W8']);
    expect(chart.values.map((text) => text.text)).toEqual(['1 h', '3 h', '5 h', '7 h']);
    expect(chart.bars[0].tip).toBe('week 1');
  });
});
