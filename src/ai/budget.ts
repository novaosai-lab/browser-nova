import { NovaError, NovaErrorCode } from '../shared/errors';

export interface BudgetConfig {
  maxActions: number;
  maxDurationMs: number;
  requireConfirmForSensitive: boolean;
}

export class BudgetTracker {
  private actionCount = 0;
  private startTime = 0;
  private actionHistory: string[] = [];

  constructor(private config: BudgetConfig = { maxActions: 20, maxDurationMs: 180000, requireConfirmForSensitive: true }) {}

  public start() {
    this.actionCount = 0;
    this.startTime = Date.now();
    this.actionHistory = [];
  }

  public recordAction(actionName: string, params: any): { isLoop: boolean; isSensitive: boolean; reason?: string } {
    this.actionCount++;

    // 1. Check action limit
    if (this.actionCount > this.config.maxActions) {
      throw new NovaError(
        NovaErrorCode.BUDGET_EXCEEDED,
        `เกินขีดจำกัดจำนวนคำสั่งสูงสุด (${this.config.maxActions} actions) ระบบหยุดทำงานเพื่อความปลอดภัย`
      );
    }

    // 2. Check time limit
    const elapsed = Date.now() - this.startTime;
    if (elapsed > this.config.maxDurationMs) {
      throw new NovaError(
        NovaErrorCode.BUDGET_EXCEEDED,
        `เกินเวลาทำงานสูงสุด (${Math.round(this.config.maxDurationMs / 1000)} วินาที) ระบบหยุดทำงานเพื่อความปลอดภัย`
      );
    }

    // 3. Check loop detection (same action & params 3 times in a row)
    const actionKey = `${actionName}:${JSON.stringify(params)}`;
    this.actionHistory.push(actionKey);
    const lastThree = this.actionHistory.slice(-3);
    const isLoop = lastThree.length === 3 && lastThree.every((k) => k === actionKey);
    if (isLoop) {
      throw new NovaError(
        NovaErrorCode.ACTION_FAILED,
        `ตรวจพบการวนซ้ำของคำสั่ง "${actionName}" เดิมซ้ำกัน 3 ครั้ง ระบบหยุดทำงานอัตโนมัติ`
      );
    }

    // 4. Check sensitive actions (payment, delete, purchase, order, submit)
    let isSensitive = false;
    let reason: string | undefined;

    if (this.config.requireConfirmForSensitive) {
      const pStr = JSON.stringify(params).toLowerCase();
      if (
        pStr.includes('delete') ||
        pStr.includes('remove') ||
        pStr.includes('pay') ||
        pStr.includes('checkout') ||
        pStr.includes('order') ||
        pStr.includes('buy') ||
        pStr.includes('ลบ') ||
        pStr.includes('จ่าย') ||
        pStr.includes('ซื้อ')
      ) {
        isSensitive = true;
        reason = 'คำสั่งนี้อาจส่งผลต่อการลบข้อมูล หรือการทำธุรกรรม';
      }
    }

    return { isLoop: false, isSensitive, reason };
  }

  public getStats() {
    return {
      actionCount: this.actionCount,
      maxActions: this.config.maxActions,
      elapsedMs: Date.now() - this.startTime,
      maxDurationMs: this.config.maxDurationMs,
    };
  }
}
