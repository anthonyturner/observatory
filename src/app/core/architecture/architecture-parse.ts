import { fieldOf, isObject, isText, listOf, oneOf } from '../json/json-fields';
import {
  ArchitectureArea,
  ArchitectureEdge,
  ArchitectureMap,
  ArchitectureNode,
  ArchitectureRuntime,
  EDGE_KINDS,
  INJECTION_STYLES,
  NODE_KINDS,
  NODE_MARKS,
  RUNTIME_KINDS,
} from './architecture.types';

const isKind = oneOf(NODE_KINDS);
const isEdgeKind = oneOf(EDGE_KINDS);
const isStyle = oneOf(INJECTION_STYLES);
const isMark = oneOf(NODE_MARKS);
const isRuntimeKind = oneOf(RUNTIME_KINDS);
const isString = (value: unknown): value is string => typeof value === 'string';
const textOrNull = (value: unknown): string | null => (isText(value) ? value : null);
const markOrNull = (value: unknown): ArchitectureNode['marks'][number] | null =>
  isMark(value) ? value : null;

function parseRuntime(value: unknown): ArchitectureRuntime | null {
  if (!isObject(value)) return null;
  const id = fieldOf(value, 'id', isText);
  const label = fieldOf(value, 'label', isText);
  const kind = fieldOf(value, 'kind', isRuntimeKind);
  return id && label && kind ? { id, label, kind } : null;
}

function parseArea(value: unknown): ArchitectureArea | null {
  if (!isObject(value)) return null;
  const id = fieldOf(value, 'id', isText);
  const label = fieldOf(value, 'label', isText);
  return id && label ? { id, label, runtime: fieldOf(value, 'runtime', isString) ?? '' } : null;
}

function parseEndpoint(value: unknown): ArchitectureNode['endpoint'] {
  if (!isObject(value)) return null;
  const method = fieldOf(value, 'method', isText);
  const path = fieldOf(value, 'path', isText);
  return method && path ? { method, path } : null;
}

/** A node outside the project has no file, so an empty one is kept; only a missing one is not. */
function parseNode(value: unknown): ArchitectureNode | null {
  if (!isObject(value)) return null;
  const id = fieldOf(value, 'id', isText);
  const name = fieldOf(value, 'name', isText);
  const kind = fieldOf(value, 'kind', isKind);
  const file = fieldOf(value, 'file', isString);
  const area = fieldOf(value, 'area', isText);
  if (!id || !name || !kind || file === undefined || !area) return null;
  return {
    id,
    name,
    kind,
    file,
    area,
    group: fieldOf(value, 'group', isString) ?? '',
    providedIn: textOrNull(value['providedIn']),
    windows: listOf(value['windows'], textOrNull),
    marks: listOf(value['marks'], markOrNull),
    endpoint: parseEndpoint(value['endpoint']),
  };
}

function parseEdge(value: unknown): ArchitectureEdge | null {
  if (!isObject(value)) return null;
  const from = fieldOf(value, 'from', isText);
  const to = fieldOf(value, 'to', isText);
  const kind = fieldOf(value, 'kind', isEdgeKind);
  if (!from || !to || !kind) return null;
  const how = fieldOf(value, 'how', isStyle) ?? null;
  return { from, to, kind, how, members: listOf(value['members'], textOrNull) };
}

/** An edge is kept only when both its ends are nodes, so the page never follows one nowhere. */
function edgesBetween(nodes: readonly ArchitectureNode[], value: unknown): ArchitectureEdge[] {
  const ids = new Set(nodes.map((node) => node.id));
  return listOf(value, parseEdge).filter(({ from, to }) => ids.has(from) && ids.has(to));
}

/** The areas that hold a node, so the area filter never offers a part with nothing to draw. */
function areasWithNodes(nodes: readonly ArchitectureNode[], value: unknown): ArchitectureArea[] {
  const inUse = new Set(nodes.map(({ area }) => area));
  return listOf(value, parseArea).filter(({ id }) => inUse.has(id));
}

/** The architecture map, with any entry that does not parse dropped; null when it is not one. */
export function parseArchitecture(body: unknown): ArchitectureMap | null {
  if (!isObject(body) || !Array.isArray(body['nodes']) || !Array.isArray(body['edges'])) {
    return null;
  }
  const nodes = listOf(body['nodes'], parseNode);
  return {
    project: fieldOf(body, 'project', isText) ?? '',
    scannedAt: fieldOf(body, 'scannedAt', isText) ?? '',
    runtimes: listOf(body['runtimes'], parseRuntime),
    areas: areasWithNodes(nodes, body['areas']),
    windows: listOf(body['windows'], textOrNull),
    nodes,
    edges: edgesBetween(nodes, body['edges']),
  };
}
