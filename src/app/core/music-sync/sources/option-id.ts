/** An entry's id is its source's id, or `<source id>:<detail>` where one source
 *  offers several, such as one per device. */
const DETAIL_SEPARATOR = ':';

export function optionIdOf(sourceId: string, detail: string): string {
  return `${sourceId}${DETAIL_SEPARATOR}${detail}`;
}

export function sourceIdOf(optionId: string): string {
  const at = optionId.indexOf(DETAIL_SEPARATOR);
  return at < 0 ? optionId : optionId.slice(0, at);
}

/** The detail after the source's id; null for the source's own entry. */
export function detailOf(optionId: string): string | null {
  const at = optionId.indexOf(DETAIL_SEPARATOR);
  return at < 0 ? null : optionId.slice(at + 1);
}
