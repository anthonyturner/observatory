import type { ToolCall, ToolSpec } from '../chat-messages.ts';
import { ToolArgError } from '../tools/tool-args.ts';
import type { AgentTool, ToolArgs, ToolContext, ToolResult } from './agent-tool.ts';

/** The tools Jev may call, by name. */
export interface ToolRegistry {
  readonly specs: readonly ToolSpec[];
  /** Runs one call; a call the model got wrong comes back as an error for it to read. */
  run(call: ToolCall, context: ToolContext): Promise<ToolResult>;
}

const COULD_NOT_READ = 'That could not be read just now.';

const failed = (error: string): ToolResult => ({ content: { error } });

function argsOf(call: ToolCall): ToolArgs {
  let args: unknown;
  try {
    args = JSON.parse(call.arguments || '{}');
  } catch {
    throw new ToolArgError('The arguments were not JSON.');
  }
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw new ToolArgError('The arguments must be an object.');
  }
  return args as ToolArgs;
}

/** The tools in `tools`, each run by the name the model calls it by. A tool
 *  that fails to read its data is logged and told to the model, which says so,
 *  rather than failing the whole reply. */
export function toolRegistry(
  tools: readonly AgentTool[],
  warn: (line: string) => void = console.warn,
): ToolRegistry {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  return {
    specs: tools.map(({ name, description, parameters }) => ({ name, description, parameters })),
    run: async (call, context) => {
      const tool = byName.get(call.name);
      if (!tool) return failed(`There is no tool called ${call.name}.`);
      try {
        return await tool.run(argsOf(call), context);
      } catch (error) {
        if (error instanceof ToolArgError) return failed(error.message);
        warn(
          `Jev's ${call.name} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return failed(COULD_NOT_READ);
      }
    },
  };
}
