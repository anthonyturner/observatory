export type Shell = 'bash' | 'powershell';

/** A command to paste, and the shell it is quoted for. */
export interface ShellCommand {
  readonly shell: string;
  readonly command: string;
}

interface ShellQuoting {
  readonly label: string;
  readonly quote: (text: string) => string;
}

/**
 * How each shell reads a quoted argument. A pasted command must reach
 * `claude` as one prompt whatever the request says, so each shell gets its
 * own quoting rather than one form that is only nearly right in both:
 *
 * - bash: double quotes, unless the text holds something bash expands inside
 *   them; then single quotes, each `'` written as `'\''`.
 * - PowerShell: single quotes always. It expands `$` and backticks inside
 *   double quotes, and takes the curly double quotes as `"`, so a `”` from a
 *   phone or a transcript would end the string. Inside single quotes it takes
 *   ‘ ’ ‚ ‛ as quote marks too, and escapes one by doubling it.
 *
 * cmd.exe is not served: it expands `%NAME%` inside any quotes.
 */
const SHELLS: Readonly<Record<Shell, ShellQuoting>> = {
  bash: {
    label: 'bash',
    quote: (text) => (/["$`\\!]/.test(text) ? `'${text.replace(/'/g, "'\\''")}'` : `"${text}"`),
  },
  powershell: {
    label: 'PowerShell',
    quote: (text) => `'${text.replace(/['‘’‚‛]/g, (mark) => mark + mark)}'`,
  },
};

/** Every shell served: the hosted site cannot know which one its reader has. */
export const ALL_SHELLS: readonly Shell[] = ['powershell', 'bash'];

/** The one shell this machine's owner pastes into. */
export const localShells = (platform: NodeJS.Platform): readonly Shell[] => [
  platform === 'win32' ? 'powershell' : 'bash',
];

/** The command that runs `prompt` as Claude Code in one shell. A prompt that
 *  starts with a dash would be read as an option, so it gains a leading space
 *  inside the quotes; the CLI's help does not say it accepts `--`. */
export function commandFor(prompt: string, shell: Shell): string {
  const flat = prompt.replace(/\s*\n\s*/g, ' ').trim();
  return `claude -p ${SHELLS[shell].quote(flat.startsWith('-') ? ` ${flat}` : flat)}`;
}

export const commandsFor = (prompt: string, shells: readonly Shell[]): ShellCommand[] =>
  shells.map((shell) => ({ shell: SHELLS[shell].label, command: commandFor(prompt, shell) }));
