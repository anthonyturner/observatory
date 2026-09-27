import { ReplyTier } from '../voice/reply-voice';
import { Json, fieldOf, isNumber, isObject, isText, listOf, oneOf } from '../json/json-fields';
import {
  AskOption,
  AssistantStatus,
  JevState,
  ReplySource,
  ReplyVia,
  RouteReply,
  RoutePick,
  RunTicket,
  ShellCommand,
  SiteWhere,
  Skill,
} from './assistant.types';

const JEV_STATES: readonly JevState[] = ['on', 'off'];
const WHERES: readonly SiteWhere[] = ['local', 'hosted'];
const VIAS: readonly ReplyVia[] = ['keyword', 'agent', 'pick', 'skill'];
const TIERS: readonly ReplyTier[] = [1, 2, 3];

const isPickValue = (value: unknown): value is string | number | null =>
  value === null || typeof value === 'string' || typeof value === 'number';

function parseSkill(value: unknown): Skill | null {
  if (!isObject(value) || !isText(value['id']) || !isText(value['label'])) return null;
  const description = fieldOf(value, 'description', isText);
  const project = fieldOf(value, 'project', isText);
  return {
    id: value['id'],
    label: value['label'],
    ...(description ? { description } : {}),
    ...(project ? { project } : {}),
  };
}

function parsePick(value: unknown): RoutePick | null {
  if (!isObject(value) || !Object.values(value).every(isPickValue)) return null;
  return value as RoutePick;
}

function parseOption(value: unknown): AskOption | null {
  if (!isObject(value) || !isText(value['label'])) return null;
  const pick = parsePick(value['pick']);
  return pick ? { label: value['label'], pick } : null;
}

function parseCommand(value: unknown): ShellCommand | null {
  if (!isObject(value) || !isText(value['command'])) return null;
  return { shell: fieldOf(value, 'shell', isText) ?? null, command: value['command'] };
}

/** Each shell's command, or the lone `command` when the router gave no list. */
function commandsOf(body: Json): ShellCommand[] {
  const commands = listOf(body['commands'], parseCommand);
  const lone = fieldOf(body, 'command', isText);
  return commands.length || !lone ? commands : [{ shell: null, command: lone }];
}

/** The local runner's ticket for a proposal, whole or not at all: Run needs
 *  every field of it. */
function parseRunTicket(value: unknown): RunTicket | undefined {
  if (!isObject(value)) return undefined;
  const { token, folder, name, expiresAt, limitMs, command } = value;
  if (!isText(token) || !isText(folder) || !isText(name) || !isText(command)) return undefined;
  if (!isNumber(expiresAt) || !isNumber(limitMs)) return undefined;
  return { token, folder, name, expiresAt, limitMs, command };
}

function parseSource(value: unknown): ReplySource | null {
  if (!isObject(value) || !isText(value['title']) || !isText(value['url'])) return null;
  return { title: value['title'], url: value['url'] };
}

/** What `GET /api/route` returns, or null when it is not that. */
export function parseAssistantStatus(body: unknown): AssistantStatus | null {
  if (!isObject(body)) return null;
  const jev = fieldOf(body, 'jev', oneOf(JEV_STATES));
  const where = fieldOf(body, 'where', oneOf(WHERES));
  if (!jev || !where || !Array.isArray(body['skills'])) return null;
  return { jev, where, skills: listOf(body['skills'], parseSkill) };
}

/** What `POST /api/route` returns, or null when it is not an object. A field
 *  of the wrong kind is left out, as if the router had not sent it. */
export function parseRouteReply(body: unknown): RouteReply | null {
  if (!isObject(body)) return null;
  const text = (key: string): string | undefined => fieldOf(body, key, isText);
  return {
    via: fieldOf(body, 'via', oneOf(VIAS)),
    jev: fieldOf(body, 'jev', oneOf(JEV_STATES)),
    tier: fieldOf(body, 'tier', oneOf(TIERS)),
    action: text('action'),
    op: text('op'),
    href: text('href'),
    says: text('says'),
    text: text('text'),
    by: text('by'),
    note: text('note'),
    question: text('question'),
    ask: listOf(body['ask'], parseOption),
    prompt: text('prompt'),
    commands: commandsOf(body),
    project: text('project'),
    runWhy: text('runWhy'),
    run: parseRunTicket(body['run']),
    sources: listOf(body['sources'], parseSource),
  };
}
