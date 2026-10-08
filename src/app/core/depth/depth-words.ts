import { plural } from '../../shared/text/plural';
import { DepthModule, Verdict } from './depth.types';

const VERDICT_WORDS: Readonly<Record<Verdict, string>> = {
  deep: 'Deep',
  balanced: 'Balanced',
  shallow: 'Shallow',
};

/** From this depth up, a whole number reads better than a decimal. */
const WHOLE_FROM = 10;

export const verdictWord = (verdict: Verdict): string => VERDICT_WORDS[verdict];

/** "4.2", or "37" once the decimal stops mattering. */
export const depthText = (depth: number): string =>
  depth >= WHOLE_FROM ? String(Math.round(depth)) : depth.toFixed(1);

/** The file's name and the folder it is in, for a heading that puts the name first. */
export function pathParts({ file, folder }: DepthModule): {
  readonly name: string;
  readonly folder: string;
} {
  return { name: file.slice(folder ? folder.length + 1 : 0), folder };
}

/** A module's three numbers in one line, as a list row shows them. */
export const numbersLine = (module: DepthModule): string =>
  `${module.implementation} statements · ${module.interfaceSize} to learn · depth ${depthText(module.depth)}`;

/** A module said aloud: what a screen reader announces when a planet takes focus. */
export const spokenSummary = (module: DepthModule): string =>
  `${module.file}, ${verdictWord(module.verdict).toLowerCase()}. ` +
  `${plural(module.implementation, 'statement')} of work, ` +
  `${plural(module.interfaceSize, 'thing')} to learn, depth ${depthText(module.depth)}.`;
