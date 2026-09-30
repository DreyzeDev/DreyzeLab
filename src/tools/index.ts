import { createGlobTool } from './glob.js';
import { createGrepTool } from './grep.js';
import { createListDirectoryTool } from './list-directory.js';
import { createReadFileTool } from './read-file.js';
import { ToolRegistry } from './registry.js';

export { ToolRegistry } from './registry.js';
export type { ToolDefinition, ToolExecutionContext, ToolResult } from './types.js';

export function createReadOnlyToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(createReadFileTool());
  registry.register(createListDirectoryTool());
  registry.register(createGlobTool());
  registry.register(createGrepTool());
  return registry;
}
