import { ModelAdapter, ModelDecision, ModelMessage } from './base';
import { PageObservation } from '../observation';
import { ToolDefinition } from '../tools';

export class MockAdapter implements ModelAdapter {
  public name = 'mock';
  private stepCount = 0;

  public async generateDecision(
    userPrompt: string,
    history: ModelMessage[],
    observation: PageObservation,
    _tools: ToolDefinition[]
  ): Promise<ModelDecision> {
    const prompt = userPrompt.toLowerCase();
    const toolHistory = history.filter((h) => h.role === 'tool');
    const stepCount = toolHistory.length;

    // 1. Check if prompt asks to navigate to a specific URL
    const urlMatch = userPrompt.match(/https?:\/\/[^\s]+/i);
    if (urlMatch && stepCount === 0 && !observation.url.includes(urlMatch[0])) {
      return {
        type: 'tool_call',
        toolName: 'navigate',
        args: { url: urlMatch[0] },
      };
    }

    // 2. Search flow (ค้นหา / search)
    if (prompt.includes('ค้นหา') || prompt.includes('search')) {
      const queryMatch = userPrompt.match(/คำว่า\s*["']?([^"'\s]+)["']?/i) || userPrompt.match(/search\s+for\s+["']?([^"'\s]+)["']?/i);
      const query = queryMatch ? queryMatch[1] : 'nova';

      if (stepCount === 0 || (stepCount === 1 && toolHistory[0].toolResult?.name === 'navigate')) {
        // Find search input
        const searchInput = observation.interactiveElements.find(
          (el) => el.testid === 'search' || el.selector.includes('search') || el.name === 'q' || el.name === 'search'
        );
        return {
          type: 'tool_call',
          toolName: 'fill',
          args: {
            selector: searchInput ? searchInput.selector : '[data-testid=search]',
            value: query,
          },
        };
      }

      if (stepCount === 1 || (stepCount === 2 && toolHistory[0].toolResult?.name === 'navigate')) {
        const submitBtn = observation.interactiveElements.find(
          (el) => el.testid === 'submit' || el.selector.includes('submit') || el.text.includes('ค้นหา') || el.text.includes('Search')
        );
        return {
          type: 'tool_call',
          toolName: 'click',
          args: {
            selector: submitBtn ? submitBtn.selector : '[data-testid=submit]',
          },
        };
      }

      if (stepCount === 2 || (stepCount === 3 && toolHistory[0].toolResult?.name === 'navigate')) {
        return {
          type: 'tool_call',
          toolName: 'assertText',
          args: {
            selector: '[data-testid=result]',
            contains: query,
          },
        };
      }

      if (stepCount === 3 || (stepCount === 4 && toolHistory[0].toolResult?.name === 'navigate')) {
        return {
          type: 'tool_call',
          toolName: 'screenshot',
          args: {
            artifactName: `search_result_${query}.png`,
          },
        };
      }

      return {
        type: 'finish',
        message: `ค้นหาคำว่า "${query}" สำเร็จเรียบร้อย พบผลลัพธ์บนหน้าเว็บและได้บันทึกภาพถ่ายหน้าจอไว้เป็นหลักฐานแล้ว`,
      };
    }

    // 3. Network / Error inspection flow (ตรวจ request / network / error)
    if (prompt.includes('request') || prompt.includes('network') || prompt.includes('ล้มเหลว') || prompt.includes('error')) {
      if (stepCount === 0) {
        return {
          type: 'tool_call',
          toolName: 'inspectNetwork',
          args: {},
        };
      }
      if (stepCount === 1) {
        return {
          type: 'tool_call',
          toolName: 'inspectConsole',
          args: {},
        };
      }
      return {
        type: 'finish',
        message: `ตรวจสอบ Network และ Console เรียบร้อยแล้ว บนหน้าเว็บ ${observation.url}`,
      };
    }

    // 4. Form submission flow
    if (prompt.includes('กรอก') || prompt.includes('form') || prompt.includes('สมัคร')) {
      if (stepCount === 0) {
        return {
          type: 'tool_call',
          toolName: 'fill',
          args: { selector: 'input[name="username"], [data-testid="username"], input:first-of-type', value: 'novatest' },
        };
      }
      return {
        type: 'finish',
        message: `กรอกฟอร์มทดสอบเรียบร้อยแล้ว`,
      };
    }

    // Default fallback: report observation
    return {
      type: 'finish',
      message: `หน้าเว็บปัจจุบันคือ "${observation.title}" (${observation.url}) พบ ${observation.interactiveElements.length} interactive elements พร้อมใช้งาน`,
    };
  }
}
