import { fitLinks } from './links-fit';

const WIDTHS = [100, 100, 100, 100, 100];
const MORE = 60;

describe('fitLinks', () => {
  it('shows every link, with More beside them, when they all fit', () => {
    expect(fitLinks(560, WIDTHS, MORE)).toEqual({ visible: 5, isMenu: false });
    expect(fitLinks(5000, WIDTHS, MORE)).toEqual({ visible: 5, isMenu: false });
  });

  it('gives up links from the right end, one at a time, as the room shrinks', () => {
    expect(fitLinks(559, WIDTHS, MORE).visible).toBe(4);
    expect(fitLinks(460, WIDTHS, MORE).visible).toBe(4);
    expect(fitLinks(459, WIDTHS, MORE).visible).toBe(3);
    expect(fitLinks(360, WIDTHS, MORE)).toEqual({ visible: 3, isMenu: false });
  });

  it('keeps the first links and never reorders, however the widths vary', () => {
    const uneven = [40, 200, 40, 40];

    expect(fitLinks(40 + 200 + 40 + MORE, uneven, MORE).visible).toBe(3);
    expect(fitLinks(40 + 200 + 40 + MORE - 1, uneven, MORE)).toEqual({ visible: 0, isMenu: true });
  });

  it('becomes a Menu button when fewer than three links fit', () => {
    expect(fitLinks(359, WIDTHS, MORE)).toEqual({ visible: 0, isMenu: true });
    expect(fitLinks(0, WIDTHS, MORE)).toEqual({ visible: 0, isMenu: true });
    expect(fitLinks(-40, WIDTHS, MORE)).toEqual({ visible: 0, isMenu: true });
  });

  it('wants fewer links beside More when there are fewer to show', () => {
    expect(fitLinks(160, [100], MORE)).toEqual({ visible: 1, isMenu: false });
    expect(fitLinks(100, [100], MORE)).toEqual({ visible: 0, isMenu: true });
    expect(fitLinks(MORE, [], MORE)).toEqual({ visible: 0, isMenu: false });
  });

  it('is a Menu button until every link has been measured', () => {
    expect(fitLinks(5000, [100, 100, 0, 100], MORE)).toEqual({ visible: 0, isMenu: true });
    expect(fitLinks(5000, [100, 100, Number.NaN], MORE)).toEqual({ visible: 0, isMenu: true });
  });
});
