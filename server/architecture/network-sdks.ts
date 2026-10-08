/**
 * The packages that talk to an outside service over the network, by the
 * service the map shows them as. A key is a whole package name, or a scope
 * (`@octokit`) that covers every package in it. Add a package here and every
 * scan counts an import of it as reaching that service.
 */
const SERVICE_OF_PACKAGE: ReadonlyMap<string, string> = new Map([
  ['@anthropic-ai/sdk', 'anthropic'],
  ['@aws-sdk', 'aws'],
  ['@azure', 'azure'],
  ['@google-cloud', 'google-cloud'],
  ['@octokit', 'github'],
  ['@sendgrid/mail', 'sendgrid'],
  ['@slack', 'slack'],
  ['@supabase/supabase-js', 'supabase'],
  ['@upstash', 'upstash'],
  ['@vercel/blob', 'vercel-blob'],
  ['@vercel/kv', 'vercel-kv'],
  ['firebase', 'firebase'],
  ['firebase-admin', 'firebase'],
  ['imapflow', 'imap-server'],
  ['ioredis', 'redis'],
  ['mongodb', 'mongodb'],
  ['mysql2', 'mysql'],
  ['nodemailer', 'smtp-server'],
  ['openai', 'openai'],
  ['pg', 'postgres'],
  ['redis', 'redis'],
  ['stripe', 'stripe'],
  ['twilio', 'twilio'],
]);

/** Which package an import specifier names: its scope and name, or just its name, without any subpath. */
function packageNames(specifier: string): string[] {
  const [first = '', second = ''] = specifier.split('/');
  return first.startsWith('@') ? [`${first}/${second}`, first] : [first];
}

/** The outside service a package import talks to; null for a package that is not a network client. */
export function serviceOfImport(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null;
  const found = packageNames(specifier).find((name) => SERVICE_OF_PACKAGE.has(name));
  return found === undefined ? null : (SERVICE_OF_PACKAGE.get(found) ?? null);
}
