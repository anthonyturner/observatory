import { PULL_BUCKETS, PullBucket } from '../projects/projects-report';

/** One open pull request in a frame. */
export interface FrameItem {
  readonly number: number;
  readonly title: string;
  readonly bucket: PullBucket;
  /** How long it had sat untouched then; 0 in frames recorded before this was kept. */
  readonly idleDays: number;
}

export type Fate = 'merged' | 'closed';

/** A pull request that left the queue since the frame before. */
export interface Departed {
  readonly number: number;
  readonly title: string;
  readonly fate: Fate;
}

/** The queue as it stood at one refresh, as `GET /api/history` returns it. */
export interface Frame {
  readonly at: string;
  readonly items: readonly FrameItem[];
  readonly departed: readonly Departed[];
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;
const isBucket = (value: unknown): value is PullBucket =>
  (PULL_BUCKETS as readonly unknown[]).includes(value);
const titleOf = (value: Json): string => (typeof value['title'] === 'string' ? value['title'] : '');

function parseItem(value: unknown): FrameItem | null {
  if (!isObject(value) || !isNumber(value['number']) || !isBucket(value['bucket'])) return null;
  const idle = value['idleDays'];
  return {
    number: value['number'],
    title: titleOf(value),
    bucket: value['bucket'],
    idleDays: typeof idle === 'number' && idle >= 0 ? idle : 0,
  };
}

function parseDeparted(value: unknown): Departed | null {
  if (!isObject(value) || !isNumber(value['number'])) return null;
  const fate = value['fate'];
  if (fate !== 'merged' && fate !== 'closed') return null;
  return { number: value['number'], title: titleOf(value), fate };
}

const listOf = <T>(value: unknown, parse: (each: unknown) => T | null): T[] =>
  Array.isArray(value) ? value.map(parse).filter((each): each is T => each !== null) : [];

function parseFrame(value: unknown): Frame | null {
  if (!isObject(value) || typeof value['at'] !== 'string' || Number.isNaN(Date.parse(value['at'])))
    return null;
  return {
    at: value['at'],
    items: listOf(value['items'], parseItem),
    departed: listOf(value['departed'], parseDeparted),
  };
}

/** The frames, oldest first, read defensively: one that does not parse is left out. */
export function parseHistory(value: unknown): Frame[] | null {
  if (!isObject(value) || !Array.isArray(value['frames'])) return null;
  return listOf(value['frames'], parseFrame).sort((a, b) => a.at.localeCompare(b.at));
}
