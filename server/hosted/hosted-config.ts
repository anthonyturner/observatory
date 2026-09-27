import { MIN_SECRET_LENGTH } from './sealed-value.ts';

/** The environment variables the hosted site needs, all set on the Vercel project. */
export const REQUIRED_ENV = [
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'GITHUB_TOKEN',
  'GITHUB_OWNER',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'ALLOWED_LOGINS',
  'SESSION_SECRET',
  'CRON_SECRET',
  'PUSH_TOKEN',
] as const;

/** `PUBLIC_PREVIEW`: off, public repositories only, or private ones too. */
export type PreviewSetting = 'off' | 'on' | 'all';

export interface HostedConfig {
  readonly redis: { readonly url: string; readonly token: string };
  readonly githubToken: string;
  /** The account whose repositories are charted. */
  readonly owner: string;
  readonly oauth: { readonly clientId: string; readonly clientSecret: string };
  readonly allowedLogins: readonly string[];
  readonly sessionSecret: string;
  /** Vercel's scheduler sends this with the cron; the push command sends the other. */
  readonly machineSecrets: { readonly cron: string; readonly push: string };
  readonly siteUrl: string | null;
  readonly preview: PreviewSetting;
  readonly previewLogs: boolean;
}

export type Env = Readonly<Record<string, string | undefined>>;

/** The configuration, or what is wrong with it. */
export type ConfigResult =
  | { readonly ok: true; readonly config: HostedConfig }
  | { readonly ok: false; readonly problem: string };

const previewOf = (value: string | undefined): PreviewSetting =>
  value === 'on' || value === 'all' ? value : 'off';

/** The hosted site's configuration from its environment, checked once, at the edge. */
export function hostedConfigFrom(env: Env): ConfigResult {
  const missing = REQUIRED_ENV.filter((name) => !env[name]);
  if (missing.length) return { ok: false, problem: `missing ${missing.join(', ')}` };
  if ((env['SESSION_SECRET'] ?? '').length < MIN_SECRET_LENGTH) {
    return {
      ok: false,
      problem: `SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`,
    };
  }
  const value = (name: (typeof REQUIRED_ENV)[number]): string => env[name] ?? '';
  return {
    ok: true,
    config: {
      redis: { url: value('KV_REST_API_URL'), token: value('KV_REST_API_TOKEN') },
      githubToken: value('GITHUB_TOKEN'),
      owner: value('GITHUB_OWNER'),
      oauth: {
        clientId: value('GITHUB_CLIENT_ID'),
        clientSecret: value('GITHUB_CLIENT_SECRET'),
      },
      allowedLogins: value('ALLOWED_LOGINS').split(','),
      sessionSecret: value('SESSION_SECRET'),
      machineSecrets: { cron: value('CRON_SECRET'), push: value('PUSH_TOKEN') },
      siteUrl: env['SITE_URL']?.replace(/\/$/, '') || null,
      preview: previewOf(env['PUBLIC_PREVIEW']),
      previewLogs: env['PREVIEW_LOGS'] === 'on',
    },
  };
}
