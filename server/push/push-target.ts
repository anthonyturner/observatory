/** The hosted site to push to, and the token it answers to. */
export interface PushTarget {
  readonly site: string;
  readonly token: string;
}

/** Where the target is remembered in Observatory's own folder (`push.json`). */
export const PUSH_TARGET_KEY = 'push';

type Env = Readonly<Record<string, string | undefined>>;

/** The value of `--name=value` among `args`, if given. */
export function argOf(args: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const savedTarget = (saved: unknown): Partial<PushTarget> => {
  if (typeof saved !== 'object' || saved === null) return {};
  const { site, token } = saved as Record<string, unknown>;
  return {
    ...(typeof site === 'string' ? { site } : {}),
    ...(typeof token === 'string' ? { token } : {}),
  };
};

/**
 * Where to push: `--site=` and `--token=` first, then `OBSERVATORY_SITE` and
 * `OBSERVATORY_PUSH_TOKEN`, then what an earlier push remembered. Returns
 * null when either is still missing.
 */
export function pushTargetFrom(
  args: readonly string[],
  env: Env,
  saved: unknown,
): PushTarget | null {
  const remembered = savedTarget(saved);
  const site = argOf(args, 'site') ?? env['OBSERVATORY_SITE'] ?? remembered.site ?? '';
  const token = argOf(args, 'token') ?? env['OBSERVATORY_PUSH_TOKEN'] ?? remembered.token ?? '';
  return site && token ? { site: site.replace(/\/$/, ''), token } : null;
}

/** Whether this run named its target, which is then remembered for the next. */
export const namesTarget = (args: readonly string[]): boolean =>
  argOf(args, 'site') !== undefined || argOf(args, 'token') !== undefined;
