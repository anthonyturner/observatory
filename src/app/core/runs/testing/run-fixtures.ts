import { RunEvent, RunSummary } from '../runs.types';

/** The folder the recorded run worked in. */
export const RUN_FOLDER = 'E:\\repos\\app';
export const STARTED_AT = Date.UTC(2026, 8, 26, 14, 0, 0);
const SECOND = 1000;

export function summaryOf(fields: Partial<RunSummary> = {}): RunSummary {
  return {
    id: 'run-1',
    prompt: 'Fix the failing sum test',
    folder: RUN_FOLDER,
    name: 'app',
    state: 'running',
    startedAt: STARTED_AT,
    endedAt: null,
    limitMs: 30 * 60 * SECOND,
    code: null,
    why: null,
    result: null,
    ...fields,
  };
}

/** Claude Code 2.1's stream-json for one short run, in the shapes seen live,
 *  with the runner's own state lines round it. */
const RECORDED: readonly [kind: string, data: unknown][] = [
  ['state', { state: 'starting', folder: RUN_FOLDER, limitMs: 1_800_000 }],
  [
    'claude',
    {
      type: 'system',
      subtype: 'hook_started',
      hook_id: 'hook-1',
      hook_name: 'SessionStart:startup',
      hook_event: 'SessionStart',
      session_id: 'session-1',
    },
  ],
  [
    'claude',
    {
      type: 'system',
      subtype: 'hook_response',
      hook_id: 'hook-1',
      hook_name: 'SessionStart:startup',
      hook_event: 'SessionStart',
      output: 'Write your spoken line to C:\\Users\\me\\.claude\\agent-speak\\cues\\next.txt',
      exit_code: 0,
      outcome: 'success',
      session_id: 'session-1',
    },
  ],
  ['state', { state: 'running' }],
  [
    'claude',
    {
      type: 'system',
      subtype: 'init',
      cwd: RUN_FOLDER,
      model: 'claude-opus-5-5',
      permissionMode: 'default',
      tools: ['Read', 'Edit', 'Bash', 'Write'],
      session_id: 'session-1',
    },
  ],
  ['claude', { type: 'system', subtype: 'thinking_tokens', tokens: 812, session_id: 'session-1' }],
  [
    'claude',
    {
      type: 'assistant',
      message: {
        id: 'msg-1',
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '' },
          { type: 'text', text: 'I’ll read the test first.' },
          {
            type: 'tool_use',
            id: 'toolu_read',
            name: 'Read',
            input: { file_path: `${RUN_FOLDER}\\src\\sum.spec.ts` },
          },
        ],
      },
      parent_tool_use_id: null,
      session_id: 'session-1',
    },
  ],
  [
    'claude',
    {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_read',
            content: "1\timport { sum } from './sum';\n2\texpect(sum(2, 2)).toBe(4);",
          },
        ],
      },
      parent_tool_use_id: null,
      session_id: 'session-1',
    },
  ],
  [
    'claude',
    {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'toolu_bash',
            name: 'Bash',
            input: { command: 'npm test -- sum', description: 'Run the sum test' },
          },
        ],
      },
      parent_tool_use_id: null,
      session_id: 'session-1',
    },
  ],
  [
    'claude',
    {
      type: 'system',
      subtype: 'permission_denied',
      tool_name: 'Bash',
      tool_use_id: 'toolu_bash',
      decision_reason: 'Bash(npm test -- sum) is not in your allow rules',
      session_id: 'session-1',
    },
  ],
  [
    'claude',
    {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'toolu_cue',
            name: 'Write',
            input: {
              file_path: 'C:\\Users\\me\\.claude\\agent-speak\\cues\\next.txt',
              content: 'Fixed it.',
            },
          },
        ],
      },
      parent_tool_use_id: null,
      session_id: 'session-1',
    },
  ],
  [
    'claude',
    {
      type: 'system',
      subtype: 'permission_denied',
      tool_name: 'Write',
      tool_use_id: 'toolu_cue',
      message: 'Write outside the working folder was denied',
      session_id: 'session-1',
    },
  ],
  [
    'claude',
    {
      type: 'rate_limit_event',
      rate_limit_info: { status: 'allowed', rateLimitType: 'five_hour' },
      session_id: 'session-1',
    },
  ],
  [
    'claude',
    {
      type: 'rate_limit_event',
      rate_limit_info: {
        status: 'allowed_warning',
        rateLimitType: 'seven_day',
        resetsAt: 1_790_000_000,
      },
      session_id: 'session-1',
    },
  ],
  [
    'claude',
    {
      type: 'rate_limit_event',
      rate_limit_info: {
        status: 'allowed_warning',
        rateLimitType: 'seven_day',
        resetsAt: 1_790_000_000,
      },
      session_id: 'session-1',
    },
  ],
  [
    'claude',
    {
      type: 'result',
      subtype: 'success',
      is_error: false,
      duration_ms: 83_000,
      num_turns: 6,
      result: 'Fixed the off-by-one in sum.ts.',
      total_cost_usd: 0.4213,
      session_id: 'session-1',
    },
  ],
  ['state', { state: 'done', code: 0, endedAt: STARTED_AT + 90 * SECOND }],
];

/** The recorded run's events, numbered from `from` as the runner numbers them. */
export function recordedEvents(from = 0): RunEvent[] {
  return RECORDED.map(([kind, data], index) => ({
    n: from + index,
    at: STARTED_AT + index * SECOND,
    kind,
    data,
  }));
}

export const lineOf = (event: RunEvent): string => JSON.stringify(event);

export const claudeEvent = (n: number, data: unknown): RunEvent => ({
  n,
  at: STARTED_AT + n * SECOND,
  kind: 'claude',
  data,
});
