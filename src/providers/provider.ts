export type ModelRole = 'system' | 'user' | 'assistant';

export interface ModelMessage {
  readonly role: ModelRole;
  readonly content: string;
}

export interface ModelRequest {
  readonly model: string;
  readonly messages: readonly ModelMessage[];
}

export interface ModelResponse {
  readonly text: string;
}

export interface ModelProvider {
  readonly id: string;
  complete(request: ModelRequest, signal?: AbortSignal): Promise<ModelResponse>;
}
