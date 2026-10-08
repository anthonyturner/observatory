/** A Refresh button asks for GitHub's answer now, not one the cache kept. */
export const isFresh = (query: URLSearchParams): boolean => query.get('fresh') === '1';
