import { createHmac, timingSafeEqual } from 'node:crypto';

/** A value to keep in a cookie, with when it stops counting (epoch ms). */
export type Sealed = Readonly<Record<string, unknown>> & { readonly exp: number };

export interface Sealer {
  /** `value` signed, as `payload.signature`; anyone can read it, nobody can change it. */
  seal(value: Sealed): string;
  /** The value, if the signature holds and it has not expired; otherwise null. */
  open(token: string | undefined): Sealed | null;
}

/** The shortest secret that is not guessable by trying: 32 characters. */
export const MIN_SECRET_LENGTH = 32;

const encode = (text: string): string => Buffer.from(text).toString('base64url');
const decode = (text: string): string => Buffer.from(text, 'base64url').toString('utf8');

function parseSealed(payload: string): Sealed | null {
  try {
    const value: unknown = JSON.parse(decode(payload));
    if (typeof value !== 'object' || value === null) return null;
    const exp = (value as Record<string, unknown>)['exp'];
    return typeof exp === 'number' ? (value as Sealed) : null;
  } catch {
    return null;
  }
}

/** Signs values with HMAC-SHA256 under `secret`, which must be at least 32 characters. */
export function sealer(secret: string, clock: () => number = Date.now): Sealer {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  const mac = (payload: string): string =>
    createHmac('sha256', secret).update(payload).digest('base64url');
  return {
    seal(value) {
      const payload = encode(JSON.stringify(value));
      return `${payload}.${mac(payload)}`;
    },
    open(token) {
      const [payload, signature] = (token ?? '').split('.');
      if (!payload || !signature) return null;
      const wanted = Buffer.from(mac(payload));
      const given = Buffer.from(signature);
      if (wanted.length !== given.length || !timingSafeEqual(wanted, given)) return null;
      const value = parseSealed(payload);
      return value && clock() < value.exp ? value : null;
    },
  };
}
