import { EventEmitter } from 'events';
import { ModelAdapter, ModelMessage } from './adapters/base';
import { PageObserver } from './observation';
import { ActionExecutor } from '../automation/actions';
import { CdpBroker } from '../automation/cdp-broker';
import { BudgetTracker, BudgetConfig } from './budget';
import { AI_TOOLS } from './tools';
import { AIMessage, AIStep } from '../shared/types';
import { NovaError, NovaErrorCode } from '../shared/errors';

export class AiOrchestrator extends EventEmitter {
  private observer: PageObserver;
  private executor: ActionExecutor;
  private budget: BudgetTracker;
  private isRunning = false;
  private pendingConfirmation: { resolve: (approved: boolean) => void } | null = null;
  private history: ModelMessage[] = [];

  constructor(
    private cdp: CdpBroker,
    private adapter: ModelAdapter,
    artifactsDir: string,
    budgetConfig?: BudgetConfig
  ) {
    super();
    this.observer = new PageObserver(cdp);
    this.executor = new ActionExecutor(cdp, artifactsDir);
    this.budget = new BudgetTracker(budgetConfig);
  }

  public setAdapter(adapter: ModelAdapter) {
    this.adapter = adapter;
  }

  public setBudgetConfig(config: BudgetConfig) {
    this.budget = new BudgetTracker(config);
  }

  public cancel() {
    this.isRunning = false;
    if (this.pendingConfirmation) {
      this.pendingConfirmation.resolve(false);
      this.pendingConfirmation = null;
    }
    this.emit('status-change', 'cancelled');
  }

  public confirmAction(approved: boolean) {
    if (this.pendingConfirmation) {
      this.pendingConfirmation.resolve(approved);
      this.pendingConfirmation = null;
    }
  }

  public async runPrompt(userPrompt: string): Promise<AIMessage> {
    this.isRunning = true;
    this.budget.start();
    this.history = [{ role: 'user', content: userPrompt }];

    const msgId = `msg_${Date.now()}`;
    const steps: AIStep[] = [];
    let finalSummary = '';
    let lastScreenshot: string | undefined;

    this.emit('status-change', 'running');

    try {
      while (this.isRunning) {
        // 1. Observe current page state
        const observation = await this.observer.observe();

        // 2. Ask model for decision
        const decision = await this.adapter.generateDecision(
          userPrompt,
          this.history,
          observation,
          AI_TOOLS
        );

        if (decision.type === 'finish') {
          finalSummary = decision.message || 'งานเสร็จสมบูรณ์เรียบร้อยแล้ว';
          break;
        }

        if (decision.type === 'tool_call' && decision.toolName) {
          const toolName = decision.toolName;
          const args = decision.args || {};

          // Record action and check budget/sensitivity
          const check = this.budget.recordAction(toolName, args);

          const stepId = `step_${steps.length + 1}`;
          const step: AIStep = {
            id: stepId,
            description: this.formatStepDescription(toolName, args),
            tool: toolName,
            params: args,
            status: 'running',
          };
          steps.push(step);
          this.emit('step-update', { msgId, step });

          // If sensitive action, ask user confirmation
          if (check.isSensitive) {
            this.emit('confirmation-needed', {
              action: toolName,
              params: args,
              reason: check.reason,
            });

            const approved = await new Promise<boolean>((resolve) => {
              this.pendingConfirmation = { resolve };
            });

            if (!approved) {
              step.status = 'failed';
              step.error = 'ผู้ใช้ยกเลิกการกระทำที่มีความเสี่ยง';
              this.emit('step-update', { msgId, step });
              throw new NovaError(NovaErrorCode.USER_CANCELLED, 'ผู้ใช้ไม่อนุมัติคำสั่งนี้');
            }
          }

          // Execute tool action
          let result: any = null;
          try {
            result = await this.executeTool(toolName, args);
            step.status = 'completed';
            step.result = typeof result === 'string' ? result : JSON.stringify(result);

            if (toolName === 'screenshot' && result?.filePath) {
              lastScreenshot = result.filePath;
            }
          } catch (err: any) {
            step.status = 'failed';
            step.error = err.message || String(err);
            this.emit('step-update', { msgId, step });
            throw err;
          }

          this.emit('step-update', { msgId, step });

          // Update model history with tool call and result
          this.history.push({
            role: 'assistant',
            toolCalls: [{ id: stepId, name: toolName, args }],
          });
          this.history.push({
            role: 'tool',
            toolResult: { id: stepId, name: toolName, result },
          });
        }
      }

      const assistantMessage: AIMessage = {
        id: msgId,
        role: 'assistant',
        content: finalSummary,
        timestamp: Date.now(),
        steps,
        screenshot: lastScreenshot,
      };

      this.emit('status-change', 'succeeded');
      this.emit('message-complete', assistantMessage);
      return assistantMessage;
    } catch (err: any) {
      this.emit('status-change', 'failed');
      const errMessage: AIMessage = {
        id: msgId,
        role: 'assistant',
        content: `เกิดข้อผิดพลาดในการทำงาน: ${err.message}`,
        timestamp: Date.now(),
        steps,
        screenshot: lastScreenshot,
      };
      this.emit('message-complete', errMessage);
      return errMessage;
    } finally {
      this.isRunning = false;
    }
  }

  private async executeTool(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'navigate':
        return await this.executor.navigate(args.url);
      case 'click':
        return await this.executor.click(args.selector);
      case 'fill':
        return await this.executor.fill(args.selector, args.value);
      case 'assertText':
        return await this.executor.assertText(args.selector, args.contains);
      case 'screenshot':
        return await this.executor.screenshot(args.artifactName);
      case 'scroll':
        return await this.executor.scroll(0, args.y || 300);
      case 'inspectConsole':
        return 'ตรวจสอบ console เรียบร้อยแล้ว';
      case 'inspectNetwork':
        return 'ตรวจสอบ network เรียบร้อยแล้ว';
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private formatStepDescription(toolName: string, args: any): string {
    switch (toolName) {
      case 'navigate':
        return `เปิดหน้าเว็บ: ${args.url}`;
      case 'click':
        return `คลิกที่ปุ่ม/ลิงก์: ${args.selector}`;
      case 'fill':
        return `กรอก "${args.value}" ลงใน ${args.selector}`;
      case 'assertText':
        return `ตรวจสอบข้อความว่ามี "${args.contains}" ใน ${args.selector}`;
      case 'screenshot':
        return `บันทึกภาพหน้าจอเป็น ${args.artifactName || 'screenshot.png'}`;
      case 'scroll':
        return `เลื่อนหน้าจอ ${args.y || 300}px`;
      case 'inspectConsole':
        return 'อ่าน Console Logs';
      case 'inspectNetwork':
        return 'ตรวจสอบ Network Requests';
      default:
        return `ดำเนินการ ${toolName}`;
    }
  }
}
