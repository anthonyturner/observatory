import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  IMAP_SERVERS,
  type ImapClient,
  type ImapClientOptions,
  type ImapMessage,
  MailError,
  imapInbox,
} from './imap-inbox.ts';

const LOGIN = { address: 'me@icloud.example', password: 'app-secret' };

const message = (seq: number, overrides: Partial<ImapMessage> = {}): ImapMessage => ({
  seq,
  uid: 100 + seq,
  flags: new Set(['\\Seen']),
  envelope: {
    subject: `Message ${seq}`,
    from: [{ name: `Sender ${seq}`, address: `sender${seq}@example.com` }],
  },
  internalDate: new Date(Date.UTC(2026, 9, 1, seq)),
  ...overrides,
});

interface FakeOptions {
  readonly exists?: number;
  readonly unseen?: number;
  readonly connect?: () => Promise<void>;
}

/** An IMAP client that records what it was asked, and fails any attempt to change a flag. */
function fakeClient({ exists = 30, unseen = 4, connect }: FakeOptions = {}) {
  const calls: string[] = [];
  const options: ImapClientOptions[] = [];
  let onError: ((error: unknown) => void) | null = null;
  let opened: { exists: number } | false = false;
  const refuse = (name: string) => () => {
    throw new Error(`${name} changes a message and must never be called`);
  };
  const client: ImapClient & Record<string, unknown> = {
    get mailbox() {
      return opened;
    },
    on(event, listener) {
      calls.push(`on ${event}`);
      onError = listener;
      return this;
    },
    async connect() {
      calls.push('connect');
      await connect?.();
    },
    async status(path, query) {
      calls.push(`status ${path} ${JSON.stringify(query)}`);
      return { unseen };
    },
    async getMailboxLock(path, lockOptions) {
      calls.push(`lock ${path} ${JSON.stringify(lockOptions)}`);
      opened = { exists };
      return { release: () => calls.push('release') };
    },
    async fetchAll(range, query) {
      calls.push(`fetch ${range} ${JSON.stringify(query)}`);
      const first = Number(range.split(':')[0]);
      return Array.from({ length: exists - first + 1 }, (_, index) => message(first + index));
    },
    async logout() {
      calls.push('logout');
    },
    close() {
      calls.push('close');
    },
    messageFlagsAdd: refuse('messageFlagsAdd'),
    messageFlagsSet: refuse('messageFlagsSet'),
    messageFlagsRemove: refuse('messageFlagsRemove'),
    messageDelete: refuse('messageDelete'),
    messageMove: refuse('messageMove'),
  };
  const create = (given: ImapClientOptions): ImapClient => {
    options.push(given);
    return client;
  };
  return { client, create, calls, options, emitError: (error: unknown) => onError?.(error) };
}

const request = (signal = new AbortController().signal) => ({
  login: LOGIN,
  server: IMAP_SERVERS.icloud,
  signal,
});

describe('imapInbox', () => {
  it('opens the Inbox read-only and lists the 20 newest, newest first, without bodies', async () => {
    const fake = fakeClient();

    const page = await imapInbox(fake.create)(request());

    assert.deepEqual(fake.calls, [
      'on error',
      'connect',
      'status INBOX {"unseen":true}',
      'lock INBOX {"readOnly":true}',
      'fetch 11:* {"uid":true,"flags":true,"envelope":true,"internalDate":true}',
      'release',
      'logout',
    ]);
    assert.equal(page.total, 30);
    assert.equal(page.unread, 4);
    assert.equal(page.messages.length, 20);
    assert.deepEqual(page.messages[0], {
      uid: 130,
      from: 'Sender 30',
      fromAddress: 'sender30@example.com',
      subject: 'Message 30',
      receivedAt: '2026-10-02T06:00:00.000Z',
      isUnread: false,
    });
    assert.equal(page.messages.at(-1)?.uid, 111);
  });

  it('signs in over TLS to the fixed host, with no logger to echo the password', async () => {
    const fake = fakeClient();

    await imapInbox(fake.create)(request());

    assert.deepEqual(
      { ...fake.options[0], auth: { ...fake.options[0].auth, pass: '…' } },
      {
        ...fake.options[0],
        host: 'imap.mail.me.com',
        port: 993,
        secure: true,
        logger: false,
        auth: { user: 'me@icloud.example', pass: '…' },
      },
    );
    assert.equal(fake.options[0].auth.pass, 'app-secret');
  });

  it('lists all of a small inbox, and reads nothing from an empty one', async () => {
    const small = fakeClient({ exists: 3 });
    const empty = fakeClient({ exists: 0, unseen: 0 });

    assert.equal((await imapInbox(small.create)(request())).messages.length, 3);
    assert.ok(
      small.calls.includes(
        'fetch 1:* {"uid":true,"flags":true,"envelope":true,"internalDate":true}',
      ),
    );
    assert.deepEqual(await imapInbox(empty.create)(request()), {
      total: 0,
      unread: 0,
      messages: [],
    });
    assert.ok(!empty.calls.some((call) => call.startsWith('fetch')));
  });

  it('lists no more than 20 when mail arrives between opening the Inbox and fetching', async () => {
    const fake = fakeClient({ exists: 30 });
    fake.client.fetchAll = async () =>
      Array.from({ length: 25 }, (_, index) => message(11 + index));

    const page = await imapInbox(fake.create)(request());

    assert.equal(page.messages.length, 20);
    assert.equal(page.messages[0].uid, 135);
    assert.equal(page.messages.at(-1)?.uid, 116);
  });

  it('marks unread mail, and makes do with a message that gives little', async () => {
    const fake = fakeClient({ exists: 1 });
    fake.client.fetchAll = async () => [
      {
        seq: 1,
        uid: 9,
        flags: new Set<string>(),
        envelope: { from: [{ address: 'bare@example.com' }] },
      },
    ];

    const [only] = (await imapInbox(fake.create)(request())).messages;

    assert.deepEqual(only, {
      uid: 9,
      from: 'bare@example.com',
      fromAddress: 'bare@example.com',
      subject: '',
      receivedAt: null,
      isUnread: true,
    });
  });

  it('says a refused sign-in is a sign-in failure, and still closes the connection', async () => {
    const refused = Object.assign(new Error('Authentication failed'), {
      authenticationFailed: true,
    });
    const fake = fakeClient({ connect: () => Promise.reject(refused) });

    await assert.rejects(imapInbox(fake.create)(request()), (error: unknown) => {
      assert.ok(error instanceof MailError);
      assert.equal(error.failure, 'sign-in');
      return true;
    });
    assert.ok(fake.calls.includes('logout'));
  });

  it('tells a server it cannot reach from one that is too slow', async () => {
    const failureOf = async (code: string) => {
      const fake = fakeClient({
        connect: () => Promise.reject(Object.assign(new Error(code), { code })),
      });
      try {
        await imapInbox(fake.create)(request());
        return 'listed';
      } catch (error) {
        return error instanceof MailError ? error.failure : 'not a MailError';
      }
    };

    assert.equal(await failureOf('ENOTFOUND'), 'unreachable');
    assert.equal(await failureOf('ECONNREFUSED'), 'unreachable');
    assert.equal(await failureOf('CONNECT_TIMEOUT'), 'timeout');
    assert.equal(await failureOf('ParserError3'), 'unknown');
  });

  it('hangs up when the deadline passes, and calls that a timeout', async () => {
    const deadline = new AbortController();
    const fake = fakeClient({
      connect: () =>
        new Promise((_, reject) => {
          deadline.signal.addEventListener('abort', () => reject(new Error('closed')));
        }),
    });

    const reading = imapInbox(fake.create)(request(deadline.signal));
    deadline.abort();

    await assert.rejects(
      reading,
      (error: unknown) => error instanceof MailError && error.failure === 'timeout',
    );
    assert.ok(fake.calls.includes('close'));
  });

  it('keeps a dropped connection from crashing the server, and names it as the cause', async () => {
    const fake = fakeClient();
    fake.client.status = async () => {
      fake.emitError(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }));
      throw new Error('Connection not available');
    };

    await assert.rejects(
      imapInbox(fake.create)(request()),
      (error: unknown) => error instanceof MailError && error.failure === 'unreachable',
    );
  });
});
