import type { ZodType } from 'zod';

export interface ToolExecutionContext {
  readonly workspaceRoot: string;
  readonly signal?: AbortSignal;
}

export type ToolResult<TOutput = unknown> =
  | { readonly status: 'success'; readonly output: TOutput }
  | {
      readonly status: 'failure' | 'denied' | 'timeout' | 'cancelled';
      readonly error: string;
    };

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ZodType<TInput>;
  execute(input: TInput, context: ToolExecutionContext): Promise<ToolResult<TOutput>>;
}
