import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deploymentReader,
  deploymentsOf,
  environmentNamesOf,
  latestStatusOf,
} from './deployment-reader.ts';

const SHA = 'c92d88f5fbfaded9932a7925d51f028083a15c25';

/** As Vercel posts one: the ref is the commit, the creator its app. */
const deployment = (id: number, environment: string, createdAt: string) => ({
  id,
  environment,
  sha: SHA,
  ref: SHA,
  created_at: createdAt,
  creator: { login: 'vercel[bot]', type: 'Bot' },
  payload: {},
});

describe('environmentNamesOf', () => {
  it('reads each environment’s name and leaves out one with none', () => {
    const names = environmentNamesOf({
      total_count: 3,
      environments: [{ name: 'Preview' }, { name: 'Production' }, { id: 4 }],
    });

    assert.deepEqual(names, ['Preview', 'Production']);
  });

  it('reads an answer that is not a list of environments as none', () => {
    assert.deepEqual(environmentNamesOf({ message: 'Not Found' }), []);
  });
});

describe('deploymentsOf', () => {
  it('reads the commit, the ref and who made it, newest first', () => {
    const marks = deploymentsOf([
      deployment(1, 'Preview', '2026-10-08T12:56:31Z'),
      deployment(2, 'Production', '2026-10-08T12:59:47Z'),
    ]);

    assert.deepEqual(
      marks.map((mark) => [mark.id, mark.environment]),
      [
        [2, 'Production'],
        [1, 'Preview'],
      ],
    );
    assert.deepEqual(marks[0], {
      id: 2,
      environment: 'Production',
      sha: SHA,
      ref: SHA,
      createdAt: '2026-10-08T12:59:47Z',
      creator: 'vercel[bot]',
    });
  });

  it('leaves out a deployment with no id, environment, commit or time', () => {
    const marks = deploymentsOf([
      { ...deployment(1, 'Preview', '2026-10-08T12:56:31Z'), id: 'x' },
      { ...deployment(2, 'Preview', '2026-10-08T12:56:31Z'), environment: '' },
      { ...deployment(3, 'Preview', '2026-10-08T12:56:31Z'), sha: null },
      { ...deployment(4, 'Preview', '2026-10-08T12:56:31Z'), created_at: null },
      { ...deployment(5, 'Preview', '2026-10-08T12:56:31Z'), creator: null },
    ]);

    assert.deepEqual(
      marks.map((mark) => [mark.id, mark.creator]),
      [[5, null]],
    );
  });
});

describe('latestStatusOf', () => {
  it('reads the newest status, its site and its log', () => {
    const status = latestStatusOf([
      {
        state: 'success',
        environment_url: 'https://app-fr5fezn63.vercel.app',
        log_url: 'https://vercel.com/me/app/abc',
        description: 'Deployment has completed',
        created_at: '2026-10-08T12:58:35Z',
      },
      { state: 'pending', created_at: '2026-10-08T12:57:00Z' },
    ]);

    assert.deepEqual(status, {
      state: 'success',
      environmentUrl: 'https://app-fr5fezn63.vercel.app',
      logUrl: 'https://vercel.com/me/app/abc',
      description: 'Deployment has completed',
      createdAt: '2026-10-08T12:58:35Z',
    });
  });

  it('keeps only web links, and reads an unknown state or no status as none', () => {
    const status = latestStatusOf([
      {
        state: 'in_progress',
        environment_url: 'javascript:alert(1)',
        log_url: '',
        created_at: '2026-10-08T12:58:35Z',
      },
    ]);

    assert.equal(status?.environmentUrl, null);
    assert.equal(status?.logUrl, null);
    assert.equal(status?.description, null);
    assert.equal(latestStatusOf([{ state: 'exploded', created_at: '2026-10-08T12:58:35Z' }]), null);
    assert.equal(latestStatusOf([]), null);
  });
});

describe('deploymentReader', () => {
  it('asks for one environment’s or one commit’s deployments, and the newest status only', async () => {
    const asked: string[] = [];
    const reader = deploymentReader(async (path) => {
      asked.push(path);
      return [];
    });

    await reader.deployments('me/app', { environment: 'Preview & QA', limit: 8 });
    await reader.deployments('me/app', { sha: SHA, limit: 20 });
    await reader.deployments('me/app', { limit: 500 });
    await reader.deploymentStatus('me/app', 42);
    await reader.environments('me/app');

    assert.deepEqual(asked, [
      'repos/me/app/deployments?per_page=8&environment=Preview%20%26%20QA',
      `repos/me/app/deployments?per_page=20&sha=${SHA}`,
      'repos/me/app/deployments?per_page=100',
      'repos/me/app/deployments/42/statuses?per_page=1',
      'repos/me/app/environments?per_page=100',
    ]);
  });
});
