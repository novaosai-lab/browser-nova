import { EventEmitter } from 'events';
import { Workflow, WorkflowStep, RunStatus, RunReport } from '../shared/types';
import { ActionExecutor } from './actions';
import { CdpBroker } from './cdp-broker';
import { EvidenceCollector } from './evidence';
import { NovaError, NovaErrorCode } from '../shared/errors';

export class WorkflowRunner extends EventEmitter {
  private status: RunStatus = 'idle';
  private currentStepIndex = 0;
  private isPaused = false;
  private isStopped = false;
  private pausePromiseResolve: (() => void) | null = null;
  private executor: ActionExecutor;

  constructor(
    private cdp: CdpBroker,
    private evidence: EvidenceCollector,
    artifactsDir: string
  ) {
    super();
    this.executor = new ActionExecutor(cdp, artifactsDir);

    // Listen for detach from DevTools
    this.cdp.on('debugger-detached', ({ reason }) => {
      if (this.status === 'running') {
        this.pause();
        this.emit('warning', `CDP debugger detached (${reason}). Automation has been paused.`);
      }
    });
  }

  public getStatus(): RunStatus {
    return this.status;
  }

  public pause(): void {
    if (this.status === 'running') {
      this.isPaused = true;
      this.status = 'paused';
      this.emit('status-change', this.status);
    }
  }

  public resume(): void {
    if (this.status === 'paused') {
      this.isPaused = false;
      this.status = 'running';
      this.emit('status-change', this.status);
      if (this.pausePromiseResolve) {
        this.pausePromiseResolve();
        this.pausePromiseResolve = null;
      }
    }
  }

  public stop(): void {
    this.isStopped = true;
    this.status = 'stopped';
    this.emit('status-change', this.status);
    if (this.pausePromiseResolve) {
      this.pausePromiseResolve();
      this.pausePromiseResolve = null;
    }
  }

  private async checkPause(): Promise<void> {
    if (this.isPaused && !this.isStopped) {
      await new Promise<void>((resolve) => {
        this.pausePromiseResolve = resolve;
      });
    }
    if (this.isStopped) {
      throw new NovaError(NovaErrorCode.USER_CANCELLED, 'Workflow run stopped by user.');
    }
  }

  public async runWorkflow(workflow: Workflow, currentUrl: string): Promise<RunReport> {
    this.status = 'running';
    this.isPaused = false;
    this.isStopped = false;
    this.currentStepIndex = 0;
    this.emit('status-change', this.status);

    const runId = `run_${Date.now()}`;
    const startedAt = Date.now();
    const beforeUrl = currentUrl;
    let afterUrl = currentUrl;
    const stepReports: RunReport['steps'] = [];
    const artifacts: string[] = [];
    const consoleErrors: string[] = [];
    const networkFailures: string[] = [];

    // Capture console and network errors during run
    const onConsole = (msg: any) => {
      if (msg.level === 'error') consoleErrors.push(msg.text);
    };
    const onNetwork = (req: any) => {
      if (req.failed) networkFailures.push(`${req.method} ${req.url} [${req.status || req.failureReason}]`);
    };

    this.cdp.onConsole(onConsole);
    this.cdp.onNetwork(onNetwork);

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        await this.checkPause();

        const step = workflow.steps[i];
        this.currentStepIndex = i;
        step.status = 'running';
        this.emit('step-update', { stepIndex: i, step });

        const stepStart = Date.now();
        let stepError: string | undefined;
        let stepScreenshot: string | undefined;

        try {
          // Allowed origins check if navigating
          if (step.action === 'navigate' && step.url && workflow.allowedOrigins?.length) {
            const destUrl = new URL(step.url);
            const isAllowed = workflow.allowedOrigins.some((orig) => destUrl.origin === orig);
            if (!isAllowed) {
              throw new NovaError(
                NovaErrorCode.OUT_OF_ORIGIN,
                `Origin "${destUrl.origin}" is not in workflow allowedOrigins: [${workflow.allowedOrigins.join(', ')}]`
              );
            }
          }

          // Execute action
          await this.executeStep(step);
          step.status = 'completed';
        } catch (err: any) {
          stepError = err.message || String(err);
          step.status = 'failed';
          step.error = stepError;

          // Capture error screenshot
          try {
            const errCapture = await this.executor.screenshot(`error_${runId}_step_${step.id}`);
            if (errCapture.filePath) {
              stepScreenshot = errCapture.filePath;
              artifacts.push(errCapture.filePath);
            }
          } catch {
            // Ignore screenshot failure
          }

          stepReports.push({
            stepId: step.id,
            action: step.action,
            durationMs: Date.now() - stepStart,
            status: 'failed',
            error: stepError,
            screenshot: stepScreenshot,
          });

          this.emit('step-update', { stepIndex: i, step });
          throw err;
        }

        const durationMs = Date.now() - stepStart;
        step.durationMs = durationMs;
        stepReports.push({
          stepId: step.id,
          action: step.action,
          durationMs,
          status: 'completed',
        });

        this.emit('step-update', { stepIndex: i, step });
      }

      this.status = 'completed';
    } catch (err: any) {
      // A stop() request (possibly triggered reentrantly during a step) takes
      // precedence over marking the run failed.
      this.status = this.isStopped ? 'stopped' : 'failed';
    } finally {
      // Capture where the run actually ended up. Best-effort: if CDP has
      // detached or the run was stopped, fall back to beforeUrl.
      try {
        const current = await this.getCurrentUrl();
        if (current) afterUrl = current;
      } catch {
        // Keep the beforeUrl fallback.
      }

      this.emit('status-change', this.status);

      const report: RunReport = {
        runId,
        workflowName: workflow.name,
        startedAt,
        finishedAt: Date.now(),
        status: this.status,
        beforeUrl,
        afterUrl,
        steps: stepReports,
        artifacts,
        consoleErrors,
        networkFailures,
      };

      this.evidence.saveReport(report);
      return report;
    }
  }

  private async getCurrentUrl(): Promise<string> {
    const res = await this.cdp.sendCommand<{ result: { value: string } }>('Runtime.evaluate', {
      expression: 'window.location.href',
      returnByValue: true,
    });
    return res.result?.value || '';
  }

  public async executeStep(step: WorkflowStep): Promise<any> {
    const timeout = step.timeoutMs || 8000;

    switch (step.action) {
      case 'navigate':
        if (!step.url) throw new Error('Missing "url" for navigate action');
        return await this.executor.navigate(step.url, timeout);

      case 'click':
        if (!step.selector) throw new Error('Missing "selector" for click action');
        return await this.executor.click(step.selector, timeout);

      case 'fill':
        if (!step.selector) throw new Error('Missing "selector" for fill action');
        return await this.executor.fill(step.selector, step.value ?? '', timeout);

      case 'assertText':
        if (!step.selector) throw new Error('Missing "selector" for assertText action');
        return await this.executor.assertText(step.selector, step.contains ?? '', timeout);

      case 'screenshot':
        return await this.executor.screenshot(step.artifact);

      case 'scroll':
        return await this.executor.scroll(0, 300);

      case 'wait':
        return await this.executor.wait(step.timeoutMs || 1000);

      default:
        throw new Error(`Unsupported action: ${step.action}`);
    }
  }
}
