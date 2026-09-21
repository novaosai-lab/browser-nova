import { ModelAdapter, ModelDecision, ModelMessage } from './base';
import { PageObservation } from '../observation';
import { ToolDefinition } from '../tools';
import { NovaError, NovaErrorCode } from '../../shared/errors';

export class OpenAIAdapter implements ModelAdapter {
  public name = 'openai';

  constructor(
    private apiKey: string,
    private baseUrl = 'https://api.openai.com/v1',
    private modelName = 'gpt-4o'
  ) {}

  public async generateDecision(
    userPrompt: string,
    history: ModelMessage[],
    observation: PageObservation,
    tools: ToolDefinition[]
  ): Promise<ModelDecision> {
    if (!this.apiKey) {
      throw new NovaError(NovaErrorCode.AI_API_ERROR, 'กรุณาระบุ OpenAI API Key ในการตั้งค่าก่อนเริ่มใช้งาน');
    }

    const messages: any[] = [
      {
        role: 'system',
        content: `You are Browser Nova AI Assistant. Control the browser securely.
Current Page URL: ${observation.url}
Title: ${observation.title}
Interactive Elements:
${JSON.stringify(observation.interactiveElements, null, 2)}
Page Text Summary:
${observation.visibleTextSummary.slice(0, 1000)}

Rules:
1. Select appropriate tool 1 step at a time.
2. Verify selectors against active page.
3. Call "finish" tool when task is accomplished with proof from page.`,
      },
    ];

    for (const h of history) {
      if (h.role === 'user') {
        messages.push({ role: 'user', content: h.content });
      } else if (h.role === 'assistant') {
        messages.push({
          role: 'assistant',
          content: h.content || null,
          tool_calls: h.toolCalls?.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          })),
        });
      } else if (h.role === 'tool' && h.toolResult) {
        messages.push({
          role: 'tool',
          tool_call_id: h.toolResult.id,
          content: JSON.stringify(h.toolResult.result),
        });
      }
    }

    if (messages.length === 1) {
      messages.push({ role: 'user', content: userPrompt });
    }

    const openAiTools = tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    try {
      const resp = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages,
          tools: openAiTools,
          tool_choice: 'auto',
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`OpenAI API error (${resp.status}): ${errText}`);
      }

      const data = await resp.json();
      const choice = data.choices?.[0]?.message;

      if (choice?.tool_calls?.length) {
        const tc = choice.tool_calls[0];
        const args = JSON.parse(tc.function.arguments || '{}');
        if (tc.function.name === 'finish') {
          return {
            type: 'finish',
            message: args.summary || 'เสร็จสิ้นภารกิจ',
          };
        }
        return {
          type: 'tool_call',
          toolName: tc.function.name,
          args,
        };
      }

      return {
        type: 'finish',
        message: choice?.content || 'เสร็จสิ้นภารกิจ',
      };
    } catch (err: any) {
      throw new NovaError(NovaErrorCode.AI_API_ERROR, `OpenAI Adapter failure: ${err.message}`);
    }
  }
}
