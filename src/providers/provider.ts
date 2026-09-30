import type { ModelToolCall, ModelToolDefinition } from '../core/model-tool.js';

export type ModelRole = 'system' | 'user' | 'assistant';

export interface ModelMessage {
  readonly role: ModelRole;
  readonly content: string;
}

export interface ModelRequest {
  readonly model: string;
  readonly messages: readonly ModelMessage[];
  readonly tools?: readonly ModelToolDefinition[];
}

export interface ModelResponse {
  readonly text: string;
  readonly toolCalls?: readonly ModelToolCall[];
}

export interface ModelProvider {
  readonly id: string;
  complete(request: ModelRequest, signal?: AbortSignal): Promise<ModelResponse>;
}
