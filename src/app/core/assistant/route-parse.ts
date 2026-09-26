import { ReplyTier } from '../voice/reply-voice';
import {
  AskOption,
  AssistantStatus,
  JevState,
  ReplyVia,
  RouteReply,
  RoutePick,
  ShellCommand,
  SiteWhere,
  Skill,
} from './assistant.types';

type Json = Record<string, unknown>;

const JEV_STATES: readonly JevState[] = ['on', 'off'];
const WHERES: readonly SiteWhere[] = ['local', 'hosted'];
const VIAS: readonly ReplyVia[] = ['keyword', 'jev', 'pick', 'skill'];
const TIERS: readonly ReplyTier[] = [1, 2, 3];

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';
const oneOf =
  <T>(allowed: readonly T[]) =>
  (value: unknown): value is T =>
    allowed.includes(value as T);
const isPickValue = (value: unknown): value is string | number | null =>
  value === null || typeof value === 'string' || typeof value === 'number';
const listOf = <T>(value: unknown, parse: (item: unknown) => T | null): T[] =>
  (Array.isArray(value) ? value : []).map(parse).filter((item): item is T => item !== null);

/** The field when it passes `check`, else nothing, so an odd field is dropped
 *  rather than trusted. */
function fieldOf<T>(body: Json, key: string, check: (value: unknown) => value is T): T | undefined {
  const value = body[key];
  return check(value) ? value : undefined;
}

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

const isConfidence = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value <= 1;

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
    failed: text('failed'),
    note: text('note'),
    question: text('question'),
    ask: listOf(body['ask'], parseOption),
    confidence: fieldOf(body, 'confidence', isConfidence),
    prompt: text('prompt'),
    commands: commandsOf(body),
    project: text('project'),
    runWhy: text('runWhy'),
  };
}
