import { randomBytes } from 'node:crypto';
import type { Access } from '../http/session.ts';
import { cookie, cookiesOf } from './cookies.ts';
import type { OpenRoutes } from './gated-handler.ts';
import { noticePage } from './notice-page.ts';
import { type Sealer, sealer } from './sealed-value.ts';

export interface SignInConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  /** GitHub logins let in; any case. */
  readonly allowed: readonly string[];
  /** Signs the cookies; at least 32 characters. */
  readonly secret: string;
  /** Where GitHub sends people back; it must match the OAuth app's callback. */
  readonly siteUrl: string | null;
  /** Whether someone with no session may look at the read-only preview. */
  readonly visitors: boolean;
  readonly fetch?: typeof fetch;
  readonly clock?: () => number;
}

export interface SignIn {
  readonly routes: OpenRoutes;
  access(request: Request): Exclude<Access, 'local'>;
  /** Where to sign in; the page adds `?next=`. */
  readonly signIn: string;
}

const SESSION_COOKIE = 'obs_session';
const OAUTH_COOKIE = 'obs_oauth';
const SIGN_IN_PATH = '/api/auth/login';
const CALLBACK_PATH = '/api/auth/callback';
const SIGNED_OUT_PATH = '/api/auth/signed-out';
const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;
const DAY_SECONDS = 86_400;
/** How long a sign-in may take at GitHub before it has to start again. */
const OAUTH_WINDOW_SECONDS = 600;
const STATE_BYTES = 16;
const MAX_LOGIN_LENGTH = 39;
const USER_AGENT = 'observatory';

/** Only a path on this site, so sign-in cannot be used to bounce someone elsewhere. */
export const safeNext = (next: string | null): string =>
  next !== null && /^\/(?!\/)[^\s\\]*$/.test(next) ? next : '/';

function redirect(location: string, setCookies: readonly string[] = []): Response {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  for (const each of setCookies) headers.append('set-cookie', each);
  return new Response(null, { status: 302, headers });
}

const TRY_AGAIN = { href: SIGN_IN_PATH, text: 'Try again' };

/** The login GitHub gives for an OAuth code, or null if it does not confirm one. */
async function loginFor(
  config: SignInConfig,
  code: string | null,
  redirectUri: string,
): Promise<string | null> {
  const send = config.fetch ?? fetch;
  const exchange: unknown = await send('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  }).then((response) => response.json());
  const token = (exchange as { access_token?: unknown } | null)?.access_token;
  if (typeof token !== 'string') return null;
  // The token answers "who is this?" once and is dropped: the site reads and
  // writes GitHub with its own token, never the visitor's.
  const user: unknown = await send('https://api.github.com/user', {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': USER_AGENT,
    },
  }).then((response) => response.json());
  const login = (user as { login?: unknown } | null)?.login;
  return typeof login === 'string' ? login : null;
}

/**
 * Sign-in with GitHub. Anyone may sign in; only allowed logins get a session.
 * The session is a signed cookie with the login and an expiry, nothing else.
 */
export function githubSignIn(config: SignInConfig): SignIn {
  const clock = config.clock ?? Date.now;
  const seal: Sealer = sealer(config.secret, clock);
  const allowed = new Set(
    config.allowed.map((login) => login.trim().toLowerCase()).filter(Boolean),
  );
  const callbackOf = (url: URL): string => `${config.siteUrl ?? url.origin}${CALLBACK_PATH}`;
  const isAllowed = (login: unknown): boolean =>
    typeof login === 'string' && allowed.has(login.toLowerCase());

  const routes: OpenRoutes = {
    [`GET ${SIGN_IN_PATH}`]: async (_request, url) => {
      const state = randomBytes(STATE_BYTES).toString('base64url');
      const next = safeNext(url.searchParams.get('next'));
      const to = new URL('https://github.com/login/oauth/authorize');
      to.searchParams.set('client_id', config.clientId);
      to.searchParams.set('redirect_uri', callbackOf(url));
      to.searchParams.set('state', state);
      to.searchParams.set('allow_signup', 'false');
      // No scopes: the public profile is all a login needs.
      const pending = seal.seal({ state, next, exp: clock() + OAUTH_WINDOW_SECONDS * 1000 });
      return redirect(to.href, [cookie(OAUTH_COOKIE, pending, OAUTH_WINDOW_SECONDS)]);
    },

    [`GET ${CALLBACK_PATH}`]: async (request, url) => {
      const pending = seal.open(cookiesOf(request).get(OAUTH_COOKIE));
      if (!pending || pending['state'] !== url.searchParams.get('state')) {
        return noticePage({
          status: 400,
          title: 'Sign-in expired',
          text: 'That sign-in link is stale or was not started here.',
          link: TRY_AGAIN,
        });
      }
      const login = await loginFor(config, url.searchParams.get('code'), callbackOf(url));
      if (!login) {
        const text = 'GitHub did not confirm the sign-in.';
        return noticePage({ status: 400, title: 'Sign-in failed', text, link: TRY_AGAIN });
      }
      const clearOauth = cookie(OAUTH_COOKIE, '', 0);
      if (!isAllowed(login)) {
        return noticePage({
          status: 403,
          title: 'Not on the list',
          text: `Signed in as ${login.slice(0, MAX_LOGIN_LENGTH)}, which this site does not let in.`,
          setCookie: clearOauth,
        });
      }
      const session = seal.seal({ login, exp: clock() + SESSION_DAYS * DAY_MS });
      // The cookie outlives the session it carries, so a run-out session still
      // arrives and sends its owner to sign in, rather than to the preview.
      const maxAge = 2 * SESSION_DAYS * DAY_SECONDS;
      const next = typeof pending['next'] === 'string' ? safeNext(pending['next']) : '/';
      return redirect(next, [clearOauth, cookie(SESSION_COOKIE, session, maxAge)]);
    },

    'GET /api/auth/logout': async () => redirect(SIGNED_OUT_PATH, [cookie(SESSION_COOKIE, '', 0)]),
    [`GET ${SIGNED_OUT_PATH}`]: async () =>
      noticePage({
        status: 200,
        title: 'Signed out',
        text: '',
        link: { href: SIGN_IN_PATH, text: 'Sign in again' },
      }),
  };

  return {
    routes,
    signIn: SIGN_IN_PATH,
    access(request) {
      const cookies = cookiesOf(request);
      if (isAllowed(seal.open(cookies.get(SESSION_COOKIE))?.['login'])) return 'owner';
      // Someone with no session at all looks at the preview; a session that is
      // there but has run out is the owner's, so they are sent to sign in.
      return config.visitors && !cookies.has(SESSION_COOKIE) ? 'visitor' : 'signed-out';
    },
  };
}
