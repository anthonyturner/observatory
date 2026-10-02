import { fieldOf, isObject, isText, listOf, oneOf } from '../json/json-fields';
import {
  ArchitectureArea,
  ArchitectureEdge,
  ArchitectureMap,
  ArchitectureNode,
  INJECTION_STYLES,
  NODE_KINDS,
} from './architecture.types';

const isKind = oneOf(NODE_KINDS);
const isStyle = oneOf(INJECTION_STYLES);
const isString = (value: unknown): value is string => typeof value === 'string';
const textOrNull = (value: unknown): string | null => (isText(value) ? value : null);

function parseArea(value: unknown): ArchitectureArea | null {
  if (!isObject(value)) return null;
  const id = fieldOf(value, 'id', isText);
  const label = fieldOf(value, 'label', isText);
  return id && label ? { id, label } : null;
}

function parseNode(value: unknown): ArchitectureNode | null {
  if (!isObject(value)) return null;
  const name = fieldOf(value, 'name', isText);
  const kind = fieldOf(value, 'kind', isKind);
  const file = fieldOf(value, 'file', isText);
  const area = fieldOf(value, 'area', isText);
  if (!name || !kind || !file || !area) return null;
  const group = fieldOf(value, 'group', isString) ?? '';
  return { name, kind, file, area, group, providedIn: textOrNull(value['providedIn']) };
}

function parseEdge(value: unknown): ArchitectureEdge | null {
  if (!isObject(value)) return null;
  const from = fieldOf(value, 'from', isText);
  const to = fieldOf(value, 'to', isText);
  const how = fieldOf(value, 'how', isStyle);
  if (!from || !to || !how) return null;
  return { from, to, how, members: listOf(value['members'], textOrNull) };
}

/** An edge is kept only when both its ends are nodes, so the page never follows one nowhere. */
function edgesBetween(nodes: readonly ArchitectureNode[], value: unknown): ArchitectureEdge[] {
  const names = new Set(nodes.map((node) => node.name));
  return listOf(value, parseEdge).filter(({ from, to }) => names.has(from) && names.has(to));
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
    areas: listOf(body['areas'], parseArea),
    windows: listOf(body['windows'], textOrNull),
    nodes,
    edges: edgesBetween(nodes, body['edges']),
  };
}
