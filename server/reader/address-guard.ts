import { isIP } from 'node:net';

/* The reader fetches pages on the owner's behalf, so a link must never be able
   to reach this machine or its network (a request forgery: "read
   http://192.168.1.1/admin"). Every address a host resolves to is checked, at
   connect time, so a name that resolves somewhere public once and privately
   the next time is still caught. */

const V4_BLOCKED: readonly (readonly [number, number, number])[] = [
  // [first octet, second octet low, second octet high]; -1 means any.
  [0, -1, -1], // "this network"
  [10, -1, -1], // private
  [100, 64, 127], // carrier-grade NAT
  [127, -1, -1], // loopback
  [169, 254, 254], // link-local, cloud metadata
  [172, 16, 31], // private
  [192, 168, 168], // private
  [198, 18, 19], // benchmarking
];

function isPublicV4(address: string): boolean {
  const [a, b] = address.split('.').map(Number);
  if (a >= 224) return false; // multicast and reserved
  const [, , c] = address.split('.').map(Number);
  // IETF protocol assignments and the documentation block; the rest of 192.0.x.x
  // is public (WordPress's hosting, TechCrunch among it, sits at 192.0.66.x).
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  return !V4_BLOCKED.some(
    ([first, low, high]) => a === first && (low === -1 || (b >= low && b <= high)),
  );
}

function isPublicV6(address: string): boolean {
  const lower = address.toLowerCase();
  if (lower === '::' || lower === '::1') return false;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return isPublicV4(mapped[1]);
  const head = parseInt(lower.split(':')[0] || '0', 16);
  if ((head & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((head & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
  if ((head & 0xff00) === 0xff00) return false; // multicast ff00::/8
  return true;
}

/** Whether an IP address is on the public internet. */
export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPublicV4(address);
  if (version === 6) return isPublicV6(address);
  return false;
}

const WEB_PORTS: ReadonlySet<string> = new Set(['', '80', '443']);

/** Why a URL may not be read, or null when it may: http(s), ordinary web
 *  ports, and no address literal for a private network. Names are checked
 *  again at connect time, where they resolve. */
export function urlProblem(url: URL): string | null {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'only web pages can be read';
  if (!WEB_PORTS.has(url.port)) return 'only ordinary web ports can be read';
  if (url.username || url.password) return 'addresses with a login cannot be read';
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return 'addresses on this machine or its network cannot be read';
  }
  if (isIP(host) && !isPublicAddress(host)) {
    return 'addresses on this machine or its network cannot be read';
  }
  return null;
}
