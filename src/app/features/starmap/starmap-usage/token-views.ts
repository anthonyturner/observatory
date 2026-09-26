import { ModelUsage, TokenReport } from '../../../core/usage/usage-document';
import { formatTokens } from '../../../core/usage/usage-format';
import { fmtN } from '../starmap-view';
import { FAMILIES, familyColour } from './charts/usage-families';
import { TileView, tileOf } from './usage-tile-view';

/** The token tiles: work done, cache read back, sessions and tool calls. */
export function tokenTiles({ totals }: TokenReport): TileView[] {
  return [
    tileOf('Tokens', formatTokens(totals.tokens), 'input, output and cache writes'),
    tileOf('Cache reads', formatTokens(totals.cacheRead), 'context read back from the cache'),
    tileOf('Sessions', fmtN(totals.sessions), `${fmtN(totals.messages)} replies`),
    tileOf('Tool calls', fmtN(totals.toolCalls), `${fmtN(totals.subagents)} subagents started`),
  ];
}

export interface LegendKey {
  readonly id: string;
  readonly label: string;
  readonly colour: string;
  readonly total: string;
}

/** A key for each family a model of the report belongs to, with its tokens. */
export function familyLegend(tokens: TokenReport): LegendKey[] {
  const used = new Set(tokens.models.map((model) => model.family));
  return FAMILIES.filter((family) => used.has(family.id)).map((family) => ({
    id: family.id,
    label: family.label,
    colour: family.colour,
    total: formatTokens(
      tokens.rows.reduce((total, row) => total + (row.families[family.id] ?? 0), 0),
    ),
  }));
}

export interface ModelRow {
  readonly model: string;
  readonly colour: string;
  readonly replies: string;
  readonly input: string;
  readonly output: string;
  readonly cacheWrite: string;
  readonly cacheRead: string;
}

export const modelRows = (models: readonly ModelUsage[]): ModelRow[] =>
  models.map((model) => ({
    model: model.model,
    colour: familyColour(model.family),
    replies: fmtN(model.messages),
    input: formatTokens(model.input),
    output: formatTokens(model.output),
    cacheWrite: formatTokens(model.cacheWrite),
    cacheRead: formatTokens(model.cacheRead),
  }));
