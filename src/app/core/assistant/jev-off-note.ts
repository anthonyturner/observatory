import { SiteWhere } from './assistant.types';

/** Said once, for as long as Jev is off: what still works, with a project's
 *  name in one example, and where the key goes. `code` marks what to type. */
export function jevOffNote(where: SiteWhere | null, projectName: string | null): string {
  const examples = [
    'open the orrery',
    'refresh',
    ...(projectName ? [`issues for ${projectName}`] : []),
  ]
    .map((example) => `“${example}”`)
    .join(', ');
  const key =
    where === 'hosted'
      ? 'set `OPENROUTER_API_KEY` on the Vercel project'
      : 'set `OPENROUTER_API_KEY`, or put it in `~/.claude/observatory/.env`, then restart the site';
  return `Jev is off, so only app actions work: ${examples}. Talking with Jev needs an OpenRouter key: ${key}.`;
}
