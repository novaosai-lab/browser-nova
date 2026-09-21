import { ModelAdapter, ModelDecision, ModelMessage } from './base';
import { PageObservation } from '../observation';
import { ToolDefinition } from '../tools';
import { NovaError, NovaErrorCode } from '../../shared/errors';

export class GeminiAdapter implements ModelAdapter {
  public name = 'gemini';
  private modelName: string;

  constructor(private apiKey: string, modelName = 'gemini-2.5-flash') {
    this.modelName = modelName;
  }

  public async generateDecision(
    userPrompt: string,
    history: ModelMessage[],
    observation: PageObservation,
    tools: ToolDefinition[]
  ): Promise<ModelDecision> {
    if (!this.apiKey) {
      throw new NovaError(NovaErrorCode.AI_API_ERROR, 'กรุณาระบุ Gemini API Key ในการตั้งค่าก่อนเริ่มใช้งาน');
    }

    // Send the key via header (x-goog-api-key) instead of the query string so it
    // never lands in URL logs, error messages, or proxy access logs.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent`;

    // Format system instructions
    const systemInstruction = {
      role: 'system',
      parts: [
        {
          text: `คุณคือ AI Browser Assistant ของ Browser Nova ทำหน้าที่ควบคุมเบราว์เซอร์อัตโนมัติอย่างชาญฉลาดและปลอดภัย
บริบทและสถานะหน้าเว็บปัจจุบัน:
- URL: ${observation.url}
- Title: ${observation.title}
- Interactive Elements บนหน้า:
${JSON.stringify(observation.interactiveElements, null, 2)}
- เนื้อหาข้อความบนหน้าสรุปย่อ:
${observation.visibleTextSummary.slice(0, 1000)}

กฎการทำงาน:
1. วิเคราะห์คำสั่งของผู้ใช้ (รองรับทั้งภาษาไทยและอังกฤษ) และเลือกใช้ Tool ที่เหมาะสมทีละ 1 ขั้นตอน
2. ตรวจสอบสถานะ element ให้ตรงกับ selector บนหน้าจริงก่อนคลิกหรือกรอกข้อมูล
3. ห้ามทำ action นอก origin ที่ไม่ได้ระบุ
4. เมื่อทำภารกิจเสร็จสิ้น ให้เรียก tool "finish" พร้อมสรุปผลและอ้างอิงข้อมูลจริงจากหน้าเว็บเป็นหลักฐาน
5. ห้ามเดาหรืออ้างว่าสำเร็จโดยไม่มีข้อมูลยืนยันจากหน้าเว็บ`,
        },
      ],
    };

    // Format contents
    const contents: any[] = [];

    for (const h of history) {
      if (h.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: h.content || '' }] });
      } else if (h.role === 'assistant') {
        if (h.toolCalls?.length) {
          contents.push({
            role: 'model',
            parts: h.toolCalls.map((tc) => ({
              functionCall: { name: tc.name, args: tc.args },
            })),
          });
        } else {
          contents.push({ role: 'model', parts: [{ text: h.content || '' }] });
        }
      } else if (h.role === 'tool' && h.toolResult) {
        contents.push({
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: h.toolResult.name,
                response: { result: h.toolResult.result },
              },
            },
          ],
        });
      }
    }

    // Add current prompt if contents is empty
    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: `คำสั่งของผู้ใช้: "${userPrompt}"` }],
      });
    }

    // Format function declarations
    const functionDeclarations = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          system_instruction: systemInstruction,
          contents,
          tools: [{ functionDeclarations }],
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini API error (${resp.status}): ${errText}`);
      }

      const data = await resp.json();
      const candidate = data.candidates?.[0];
      const part = candidate?.content?.parts?.[0];

      if (part?.functionCall) {
        const fc = part.functionCall;
        if (fc.name === 'finish') {
          return {
            type: 'finish',
            message: fc.args?.summary || 'เสร็จสิ้นภารกิจ',
          };
        }
        return {
          type: 'tool_call',
          toolName: fc.name,
          args: fc.args,
        };
      }

      if (part?.text) {
        return {
          type: 'finish',
          message: part.text,
        };
      }

      return {
        type: 'finish',
        message: 'ไม่สามารถระบุการกระทำถัดไปได้',
      };
    } catch (err: any) {
      throw new NovaError(NovaErrorCode.AI_API_ERROR, `Gemini Adapter failure: ${err.message}`);
    }
  }
}
