import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type SignInConfig, githubSignIn, safeNext } from './github-sign-in.ts';
import { sealer } from './sealed-value.ts';

const SECRET = 's'.repeat(32);
const NOW = Date.parse('2026-09-26T12:00:00Z');
const SITE = 'https://observatory.example';

/** GitHub's OAuth endpoints, answering for `login`; `null` refuses the code. */
function fakeGitHub(login: string | null) {
  const asked: string[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    asked.push(url);
    if (url === 'https://github.com/login/oauth/access_token') {
      const { code } = JSON.parse(String(init?.body)) as { code: string };
      return Response.json(login && code === 'good' ? { access_token: 'gho_x' } : { error: 'bad' });
    }
    return Response.json({ login });
  };
  return { fetch, asked };
}

function signInWith(overrides: Partial<SignInConfig> = {}) {
  return githubSignIn({
    clientId: 'client',
    clientSecret: 'client-secret',
    allowed: ['Me', ' other '],
    secret: SECRET,
    siteUrl: null,
    visitors: false,
    clock: () => NOW,
    ...overrides,
  });
}

const cookieHeader = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((each) => each.split(';')[0])
    .join('; ');

/** Starts a sign-in, returning its state and the cookie that carries it. */
async function started(signIn: ReturnType<typeof githubSignIn>, next = '/p/me/app') {
  const url = new URL(`${SITE}/api/auth/login?next=${encodeURIComponent(next)}`);
  const response = await signIn.routes['GET /api/auth/login'](new Request(url), url);
  const location = new URL(String(response.headers.get('location')));
  return {
    response,
    location,
    state: location.searchParams.get('state'),
    cookie: cookieHeader(response),
  };
}

async function callback(
  signIn: ReturnType<typeof githubSignIn>,
  state: string | null,
  cookie: string,
  code = 'good',
) {
  const url = new URL(`${SITE}/api/auth/callback?code=${code}&state=${state}`);
  return signIn.routes['GET /api/auth/callback'](new Request(url, { headers: { cookie } }), url);
}

describe('githubSignIn', () => {
  it('sends the sign-in to GitHub with no scopes, remembering where to return', async () => {
    const { response, location, state } = await started(signInWith());

    assert.equal(response.status, 302);
    assert.equal(location.origin + location.pathname, 'https://github.com/login/oauth/authorize');
    assert.equal(location.searchParams.get('client_id'), 'client');
    assert.equal(location.searchParams.get('redirect_uri'), `${SITE}/api/auth/callback`);
    assert.equal(location.searchParams.has('scope'), false);
    assert.ok(state);
    assert.match(response.headers.getSetCookie()[0], /^obs_oauth=.*HttpOnly; Secure; SameSite=Lax/);
  });

  it('uses SITE_URL for the callback when set', async () => {
    const { location } = await started(signInWith({ siteUrl: 'https://mine.example' }));

    assert.equal(
      location.searchParams.get('redirect_uri'),
      'https://mine.example/api/auth/callback',
    );
  });

  it('lets an allowed login in with a session, back where they started', async () => {
    const github = fakeGitHub('me');
    const signIn = signInWith({ fetch: github.fetch });
    const { state, cookie } = await started(signIn);

    const response = await callback(signIn, state, cookie);

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/p/me/app');
    const session = response.headers.getSetCookie().find((each) => each.startsWith('obs_session='));
    assert.match(String(session), /HttpOnly; Secure; SameSite=Lax; Max-Age=5184000$/);
    const request = new Request(SITE, { headers: { cookie: cookieHeader(response) } });
    assert.equal(signIn.access(request), 'owner');
  });

  it('refuses a login not on the list, with no session', async () => {
    const signIn = signInWith({ fetch: fakeGitHub('stranger').fetch });
    const { state, cookie } = await started(signIn);

    const response = await callback(signIn, state, cookie);

    assert.equal(response.status, 403);
    assert.match(await response.text(), /Signed in as stranger, which this site does not let in/);
    assert.equal(
      response.headers.getSetCookie().some((each) => each.startsWith('obs_session=')),
      false,
    );
  });

  it('refuses a stale or forged state, and a code GitHub does not confirm', async () => {
    const signIn = signInWith({ fetch: fakeGitHub('me').fetch });
    const { state, cookie } = await started(signIn);

    assert.equal((await callback(signIn, 'forged', cookie)).status, 400);
    assert.equal((await callback(signIn, state, '')).status, 400);
    assert.equal((await callback(signIn, state, cookie, 'bad')).status, 400);
  });

  it('shows a visitor the preview only when there is one and they have no session', () => {
    const bare = new Request(SITE);
    const expired = sealer(SECRET, () => NOW).seal({ login: 'me', exp: NOW - 1 });
    const stale = new Request(SITE, { headers: { cookie: `obs_session=${expired}` } });

    assert.equal(signInWith({ visitors: true }).access(bare), 'visitor');
    assert.equal(signInWith({ visitors: false }).access(bare), 'signed-out');
    // A run-out session is the owner's: they are asked to sign in, not shown the preview.
    assert.equal(signInWith({ visitors: true }).access(stale), 'signed-out');
  });

  it('signs out by clearing the session', async () => {
    const url = new URL(`${SITE}/api/auth/logout`);
    const response = await signInWith().routes['GET /api/auth/logout'](new Request(url), url);

    assert.equal(response.headers.get('location'), '/api/auth/signed-out');
    assert.match(response.headers.getSetCookie()[0], /^obs_session=; .*Max-Age=0$/);
  });
});

describe('safeNext', () => {
  it('keeps a path on this site and nothing else', () => {
    assert.equal(safeNext('/p/me/app?x=1'), '/p/me/app?x=1');
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil', 'relative', null]) {
      assert.equal(safeNext(bad), '/', String(bad));
    }
  });
});
