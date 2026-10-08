import { fieldOf, isNumber, isObject, isText, listOf, oneOf } from '../json/json-fields';
import { DepthModule, DepthPrinciple, DepthReport, VERDICTS } from './depth.types';

const isVerdict = oneOf(VERDICTS);

function parseModule(value: unknown): DepthModule | null {
  if (!isObject(value)) return null;
  const file = fieldOf(value, 'file', isText);
  const implementation = fieldOf(value, 'implementation', isNumber);
  const interfaceSize = fieldOf(value, 'interfaceSize', isNumber);
  const depth = fieldOf(value, 'depth', isNumber);
  const verdict = fieldOf(value, 'verdict', isVerdict);
  const principle = fieldOf(value, 'principle', isText);
  const folder = typeof value['folder'] === 'string' ? value['folder'] : undefined;
  const isComplete =
    file !== undefined &&
    folder !== undefined &&
    implementation !== undefined &&
    interfaceSize !== undefined &&
    depth !== undefined &&
    verdict !== undefined &&
    principle !== undefined;
  return isComplete
    ? { file, folder, implementation, interfaceSize, depth, verdict, principle }
    : null;
}

function parsePrinciple(value: unknown): DepthPrinciple | null {
  if (!isObject(value)) return null;
  const id = fieldOf(value, 'id', isText);
  const title = fieldOf(value, 'title', isText);
  const idea = fieldOf(value, 'idea', isText);
  return id && title && idea ? { id, title, idea } : null;
}

/** The report in an API answer, or null when it is not one. A module with a missing field is dropped, not guessed at. */
export function parseDepthReport(body: unknown): DepthReport | null {
  if (!isObject(body)) return null;
  const repo = fieldOf(body, 'repo', isText);
  const scannedAt = Date.parse(String(body['scannedAt']));
  if (!repo || Number.isNaN(scannedAt) || !Array.isArray(body['modules'])) return null;
  return {
    repo,
    scannedAt,
    modules: listOf(body['modules'], parseModule),
    principles: listOf(body['principles'], parsePrinciple),
  };
}
