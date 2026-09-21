import { PageObservation } from '../observation';
import { ToolDefinition } from '../tools';

export interface ModelMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  toolCalls?: { id: string; name: string; args: any }[];
  toolResult?: { id: string; name: string; result: any };
}

export interface ModelDecision {
  type: 'tool_call' | 'finish';
  toolName?: string;
  args?: any;
  message?: string;
}

export interface ModelAdapter {
  name: string;
  generateDecision(
    userPrompt: string,
    history: ModelMessage[],
    observation: PageObservation,
    tools: ToolDefinition[]
  ): Promise<ModelDecision>;
}
