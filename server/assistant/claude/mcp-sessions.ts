import { randomBytes } from 'node:crypto';
import type { ToolContext, ToolResult } from '../agent/agent-tool.ts';
import type { ToolRegistry } from '../agent/tool-registry.ts';

/** One request's tools, as Claude Code reaches them over MCP while it answers. */
export interface McpSession {
  readonly tools: ToolRegistry;
  readonly context: ToolContext;
  /** Each result, as it comes: the request's effects and sources are built from them. */
  record(result: ToolResult): void;
}

/** The token names the session in the MCP address; it is long and random, so
 *  only the Claude Code started for that request can find it. */
const TOKEN_BYTES = 24;

/** The MCP sessions open now, one per request Jev is answering. */
export class McpSessions {
  private readonly open = new Map<string, McpSession>();

  /** Opens a session; `end` closes it, after which its token finds nothing. */
  start(session: McpSession): { readonly token: string; end(): void } {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    this.open.set(token, session);
    return { token, end: () => void this.open.delete(token) };
  }

  find(token: string): McpSession | null {
    return this.open.get(token) ?? null;
  }
}
