import { ActivityLog } from './activity-log';

const call = { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'src/app.ts' } };
const answer = { type: 'tool_result', tool_use_id: 't1', is_error: false, content: 'file text' };

describe('ActivityLog', () => {
  it('asks for a first load until a page names its cursor', () => {
    const log = new ActivityLog();
    expect(log.from()).toBeNull();
    expect(log.hasRead()).toBe(false);

    log.take({ events: [], next: 64, isRestart: true });

    expect(log.from()).toBe(64);
    expect(log.hasRead()).toBe(true);
  });

  it('reads the events as the run transcript does, a result joining its call across pages', () => {
    const log = new ActivityLog();

    log.take({
      events: [{ type: 'assistant', message: { content: [call] } }],
      next: 10,
      isRestart: true,
    });
    log.take({
      events: [{ type: 'user', message: { content: [answer] } }],
      next: 20,
      isRestart: false,
    });

    expect(log.entries()).toHaveLength(1);
    expect(log.entries()[0]).toMatchObject({ kind: 'fold', name: 'Read', status: 'ok' });
  });

  it('shows a typed prompt as words sent to Claude', () => {
    const log = new ActivityLog();

    log.take({
      events: [{ type: 'user', message: { content: 'Fix the build' } }],
      next: 5,
      isRestart: true,
    });

    expect(log.entries()[0]).toMatchObject({ kind: 'fold', name: 'To Claude' });
  });
});
