import { z } from 'zod';
import type { ModelToolDefinition } from '../core/model-tool.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './types.js';

const MAX_TOOL_OUTPUT_BYTES = 64 * 1024;
const OUTPUT_TRUNCATION_MARKER = '\n[tool output truncated at 64 KiB]';

interface RegistryEntry {
  readonly modelDefinition: ModelToolDefinition;
  invoke(input: unknown, context: ToolExecutionContext): Promise<ToolResult<unknown>>;
}

export class ToolRegistry {
  readonly #tools = new Map<string, RegistryEntry>();

  register<TInput, TOutput>(definition: ToolDefinition<TInput, TOutput>): void {
    if (!/^[a-z][a-z0-9_]*$/.test(definition.name)) {
      throw new TypeError(`Invalid tool name: ${definition.name}`);
    }

    if (definition.description.trim().length === 0) {
      throw new TypeError(`Tool ${definition.name} must have a description.`);
    }

    if (this.#tools.has(definition.name)) {
      throw new TypeError(`Tool ${definition.name} is already registered.`);
    }

    const modelDefinition: ModelToolDefinition = {
      name: definition.name,
      description: definition.description,
      inputSchema: z.toJSONSchema(definition.inputSchema),
    };

    this.#tools.set(definition.name, {
      modelDefinition,
      async invoke(input, context) {
        if (context.signal?.aborted) {
          return { status: 'cancelled', error: 'Tool execution was cancelled.' };
        }

        const parsed = definition.inputSchema.safeParse(input);

        if (!parsed.success) {
          return {
            status: 'failure',
            error: formatValidationError(definition.name, parsed.error),
          };
        }

        try {
          return await definition.execute(parsed.data, context);
        } catch (error) {
          if (context.signal?.aborted || isAbortError(error)) {
            return { status: 'cancelled', error: 'Tool execution was cancelled.' };
          }

          return { status: 'failure', error: getSafeExecutionError(error) };
        }
      },
    });
  }

  getDefinitions(): readonly ModelToolDefinition[] {
    return [...this.#tools.values()].map(({ modelDefinition }) => modelDefinition);
  }

  async execute(
    name: string,
    input: unknown,
    context: ToolExecutionContext,
  ): Promise<ToolResult<unknown>> {
    const tool = this.#tools.get(name);

    if (tool === undefined) {
      return limitToolResult({ status: 'failure', error: `Unknown tool: ${name}.` });
    }

    return limitToolResult(await tool.invoke(input, context));
  }
}

function limitToolResult<TOutput>(result: ToolResult<TOutput>): ToolResult<TOutput> {
  if (result.status === 'success' && typeof result.output === 'string') {
    return {
      status: 'success',
      output: truncateUtf8(result.output) as TOutput,
    };
  }

  if (result.status !== 'success') {
    return {
      ...result,
      error: truncateUtf8(result.error),
    };
  }

  return result;
}

function truncateUtf8(value: string): string {
  if (Buffer.byteLength(value, 'utf8') <= MAX_TOOL_OUTPUT_BYTES) {
    return value;
  }

  const availableBytes =
    MAX_TOOL_OUTPUT_BYTES - Buffer.byteLength(OUTPUT_TRUNCATION_MARKER, 'utf8');
  let output = '';
  let outputBytes = 0;

  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, 'utf8');

    if (outputBytes + characterBytes > availableBytes) {
      break;
    }

    output += character;
    outputBytes += characterBytes;
  }

  return `${output}${OUTPUT_TRUNCATION_MARKER}`;
}

function formatValidationError(toolName: string, error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    return path.length === 0 ? issue.message : `${path}: ${issue.message}`;
  });

  return `Invalid input for ${toolName}: ${issues.join('; ')}`;
}

function getSafeExecutionError(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'Tool execution failed.';
  }

  if (
    'name' in error &&
    error.name === 'WorkspacePathError' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  if (!('code' in error)) {
    return 'Tool execution failed.';
  }

  switch (error.code) {
    case 'ENOENT':
      return 'Path does not exist.';
    case 'ENOTDIR':
      return 'A path component is not a directory.';
    case 'EACCES':
    case 'EPERM':
      return 'Access to the path was denied.';
    default:
      return 'Tool execution failed.';
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}
