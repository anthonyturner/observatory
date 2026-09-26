/** A request's cookies by name. */
export function cookiesOf(request: Request): ReadonlyMap<string, string> {
  const cookies = new Map<string, string>();
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    try {
      cookies.set(part.slice(0, at).trim(), decodeURIComponent(part.slice(at + 1).trim()));
    } catch {
      // A value that is not valid percent-encoding was not set by this site.
    }
  }
  return cookies;
}

/**
 * A `set-cookie` value. HttpOnly keeps it from the page's scripts, Secure from
 * plain HTTP, and SameSite=Lax from another site's writes; zero `maxAgeSeconds`
 * clears it.
 */
export const cookie = (name: string, value: string, maxAgeSeconds: number): string =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
