import type { QueueReport } from '../../queue/queue-report.ts';
import type { JsonSchema } from '../chat-messages.ts';
import type { AgentTool, ToolArgs, ToolContext, ToolResult } from '../agent/agent-tool.ts';
import type { Project, QueueAct } from '../route-contract.ts';
import { PROJECT_ARG } from './project-schema.ts';
import { snoozeSpanUntil } from './snooze-date.ts';
import {
  ToolArgError,
  optionalProject,
  requiredProject,
  requiredText,
  requiredWholeNumber,
} from './tool-args.ts';

type ReadQueue = (repo: string) => Promise<QueueReport>;

/** What the model reads back from a tool that only proposes a change. */
const ASKS_FIRST =
  'Nothing has changed yet: the page asks the owner yes or no first, so do not say it is done.';

const NUMBER_ARG = { type: 'integer', description: 'The pull request number.' } as const;

/** Arguments that name one pull request. */
const ONE_PULL = {
  type: 'object',
  properties: { project: PROJECT_ARG, number: NUMBER_ARG },
  required: ['project', 'number'],
} as const;

/** An open pull request, as a command names it. */
interface NamedPull {
  readonly project: Project;
  readonly number: number;
}

/** A Review Queue command about one open pull request. */
interface PullCommand {
  readonly name: string;
  readonly description: string;
  readonly parameters?: JsonSchema;
  readonly actOf: (pull: NamedPull, args: ToolArgs) => QueueAct;
  /** What the model reads back once the page has it. */
  readonly note: string;
}

const queueResult = (act: QueueAct, content: object): ToolResult => ({
  content,
  effect: { kind: 'queue', act },
});

/** The pull request the arguments name, checked open in its queue, so the
 *  model hears at once when it named one that is not. */
async function namedPull(
  args: ToolArgs,
  context: ToolContext,
  queue: ReadQueue,
): Promise<NamedPull> {
  const project = requiredProject(args, 'project', context);
  const number = requiredWholeNumber(args, 'number');
  const report = await queue(project.repo);
  if (!report.items.some((item) => item.number === number)) {
    throw new ToolArgError(
      `${project.name} has no open pull request ${number}; project_pull_requests lists them.`,
    );
  }
  return { project, number };
}

const pullTool = (command: PullCommand, queue: ReadQueue): AgentTool => ({
  name: command.name,
  description: command.description,
  parameters: command.parameters ?? ONE_PULL,
  run: async (args, context) => {
    const pull = await namedPull(args, context, queue);
    const pullRequest = `${pull.project.name} pull request ${pull.number}`;
    return queueResult(command.actOf(pull, args), { pullRequest, note: command.note });
  },
});

const target = ({ project, number }: NamedPull) => ({ repo: project.repo, pr: number });

const whatsBlockingTool: AgentTool = {
  name: 'whats_blocking',
  description:
    "Read out the owner's most blocked open pull requests, across every project or in one, " +
    'then offer to open one or send a crew.',
  parameters: { type: 'object', properties: { project: PROJECT_ARG } },
  run: async (args, context) => {
    const project = optionalProject(args, 'project', context);
    return queueResult(
      { kind: 'blocking', repo: project?.repo ?? null },
      { done: 'The page reads out the top three, blocked first, in its own words.' },
    );
  },
};

/** The Review Queue's commands as Jev's tools. Each hands the page the same
 *  command typing it would, so the page reads, asks and records as it always
 *  does; none of them changes anything itself. */
export function queueTools(queue: ReadQueue, now: () => Date = () => new Date()): AgentTool[] {
  const commands: readonly PullCommand[] = [
    {
      name: 'open_pull_request',
      description: "Open one pull request on its project's page, for the owner to look at.",
      actOf: (pull) => ({ kind: 'open', ...target(pull) }),
      note: 'The page opens it after a second, with a button to stay.',
    },
    {
      name: 'snooze_pull_request',
      description:
        'Propose snoozing one pull request off the Review Queue until a date. The page asks the ' +
        'owner yes or no first.',
      parameters: {
        type: 'object',
        properties: {
          project: PROJECT_ARG,
          number: NUMBER_ARG,
          until: { type: 'string', description: 'The day it comes back, as YYYY-MM-DD.' },
        },
        required: ['project', 'number', 'until'],
      },
      actOf: (pull, args) => ({
        kind: 'snooze',
        ...target(pull),
        ...snoozeSpanUntil(requiredText(args, 'until'), now()),
      }),
      note: ASKS_FIRST,
    },
    {
      name: 'dismiss_pull_request',
      description:
        'Propose dismissing one pull request from the Review Queue until it changes. The page ' +
        'asks the owner yes or no first.',
      actOf: (pull) => ({ kind: 'dismiss', ...target(pull) }),
      note: ASKS_FIRST,
    },
    {
      name: 'send_crew',
      description:
        'Propose sending a crew (a Claude Code agent) to fix one failing or conflicted pull ' +
        'request. The page checks a crew can take it and asks the owner yes or no first.',
      actOf: (pull) => ({ kind: 'crew', ...target(pull) }),
      note: ASKS_FIRST,
    },
  ];
  return [whatsBlockingTool, ...commands.map((command) => pullTool(command, queue))];
}
