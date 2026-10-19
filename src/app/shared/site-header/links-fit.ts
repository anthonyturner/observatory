/** Fewest links worth showing beside More. With fewer, the bar folds into one Menu button. */
export const MIN_LINKS = 3;

/** What the bar shows of its screen links. */
export interface LinksFit {
  /** How many of the leading links stand on the bar; the rest are behind More. */
  readonly visible: number;
  /** Too few links fit to be worth a row, so the bar is one Menu button and every link is behind it. */
  readonly isMenu: boolean;
}

/**
 * Which links stand on the bar. They leave from the right end, so the ones that stay are always
 * the first ones, in order. `available` is the room for the links and the More button, and
 * `linkWidths` are the links' own widths, in order, measured whether the link is shown or not.
 * A width that has not been measured yet leaves the bar as a Menu button.
 */
export function fitLinks(
  available: number,
  linkWidths: readonly number[],
  moreWidth: number,
): LinksFit {
  const needed = Math.min(MIN_LINKS, linkWidths.length);
  let room = available - moreWidth;
  let visible = 0;
  while (visible < linkWidths.length && linkWidths[visible] <= room) {
    room -= linkWidths[visible];
    visible++;
  }
  const isMenu = visible < needed || linkWidths.some((width) => !(width > 0));
  return { visible: isMenu ? 0 : visible, isMenu };
}
