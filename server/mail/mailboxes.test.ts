import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type InboxFetcher, MailError } from './imap-inbox.ts';
import { mailboxes } from './mailboxes.ts';
import type { InboxPage } from './mail-types.ts';

const PASSWORD = 'app-secret-123';
const LOGINS = {
  icloud: { address: 'me@icloud.example', password: PASSWORD },
  gmail: null,
};
const PAGE: InboxPage = {
  total: 1,
  unread: 1,
  messages: [
    {
      uid: 7,
      from: 'Apple',
      fromAddress: 'no_reply@apple.example',
      subject: 'Your receipt',
      receivedAt: '2026-10-02T09:00:00.000Z',
      isUnread: true,
    },
  ],
};
const NOW = Date.parse('2026-10-02T12:00:00Z');

function setUp(fetchInbox: InboxFetcher, deadlineMs = 15_000) {
  let now = NOW;
  const warnings: string[] = [];
  const box = mailboxes({
    logins: LOGINS,
    fetchInbox,
    clock: () => now,
    warn: (message) => warnings.push(message),
    deadlineMs,
  });
  return { box, warnings, advance: (ms: number) => (now += ms) };
}

const counting = (answer: () => Promise<InboxPage>) => {
  let reads = 0;
  const fetchInbox: InboxFetcher = async () => {
    reads++;
    return answer();
  };
  return { fetchInbox, reads: () => reads };
};

describe('mailboxes', () => {
  it('lists a set-up account, with its address and when it was checked', async () => {
    const { box } = setUp(async () => PAGE);

    assert.deepEqual(await box.read('icloud'), {
      account: 'icloud',
      state: 'listed',
      address: 'me@icloud.example',
      checkedAt: '2026-10-02T12:00:00.000Z',
      ...PAGE,
    });
  });

  it('names the settings an account needs, never their values, and asks no server', async () => {
    const fetching = counting(async () => PAGE);
    const { box } = setUp(fetching.fetchInbox);

    assert.deepEqual(await box.read('gmail'), {
      account: 'gmail',
      state: 'off',
      settings: ['GMAIL_ADDRESS', 'GMAIL_APP_PASSWORD'],
    });
    assert.equal(fetching.reads(), 0);
  });

  it('keeps a list for a minute', async () => {
    const fetching = counting(async () => PAGE);
    const { box, advance } = setUp(fetching.fetchInbox);

    await box.read('icloud');
    advance(59_999);
    await box.read('icloud');
    assert.equal(fetching.reads(), 1);
    advance(1);
    await box.read('icloud');
    assert.equal(fetching.reads(), 2);
  });

  it('never retries a refused sign-in on its own: only Refresh, which forgets it, asks again', async () => {
    const fetching = counting(() => Promise.reject(new MailError('sign-in')));
    const { box, advance } = setUp(fetching.fetchInbox);

    assert.deepEqual(await box.read('icloud'), {
      account: 'icloud',
      state: 'failed',
      failure: 'sign-in',
      settings: ['ICLOUD_MAIL_ADDRESS', 'ICLOUD_MAIL_APP_PASSWORD'],
      checkedAt: '2026-10-02T12:00:00.000Z',
    });
    advance(24 * 60 * 60_000);
    await box.read('icloud');
    assert.equal(fetching.reads(), 1);
    box.forget('icloud');
    await box.read('icloud');
    assert.equal(fetching.reads(), 2);
  });

  it('asks a slow or unreachable server again after five minutes', async () => {
    for (const failure of ['timeout', 'unreachable'] as const) {
      const fetching = counting(() => Promise.reject(new MailError(failure)));
      const { box, advance } = setUp(fetching.fetchInbox);

      await box.read('icloud');
      advance(5 * 60_000 - 1);
      await box.read('icloud');
      assert.equal(fetching.reads(), 1, failure);
      advance(1);
      await box.read('icloud');
      assert.equal(fetching.reads(), 2, failure);
    }
  });

  it('never logs the password, even when the library’s error repeats it', async () => {
    const leak = new Error(`LOGIN me@icloud.example ${PASSWORD} failed`);
    const { box, warnings } = setUp(() =>
      Promise.reject(new MailError('sign-in', { cause: leak })),
    );

    const report = await box.read('icloud');

    assert.ok(!JSON.stringify(report).includes(PASSWORD));
    assert.equal(warnings.length, 1);
    assert.ok(!warnings[0].includes(PASSWORD));
    assert.match(warnings[0], /icloud/);
  });

  it('calls anything unexpected an unknown failure, as a value rather than a 500', async () => {
    const { box } = setUp(() => Promise.reject(new TypeError('boom')));

    assert.equal(((await box.read('icloud')) as { failure: string }).failure, 'unknown');
  });

  it('gives up at the deadline, telling the reader to hang up', async () => {
    let signal: AbortSignal | null = null;
    const { box } = setUp((request) => {
      signal = request.signal;
      return new Promise<InboxPage>(() => undefined);
    }, 5);

    const report = await box.read('icloud');

    assert.equal((report as { failure: string }).failure, 'timeout');
    assert.equal((signal as AbortSignal | null)?.aborted, true);
  });
});
