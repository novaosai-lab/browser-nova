import React, { useState, useEffect } from 'react';
import { Tab, Workflow, RunStatus, RunReport } from '../../../shared/types';
import { Play, Pause, Square, FileText, CheckCircle2, AlertCircle, Loader2, History, RotateCcw } from 'lucide-react';

interface WorkflowPanelProps {
  activeTab: Tab | null;
}

const defaultWorkflow: Workflow = {
  schemaVersion: 1,
  name: 'ค้นหาบนเว็บ HTTP',
  allowedOrigins: ['http://127.0.0.1:8080'],
  steps: [
    { id: 'open', action: 'navigate', url: 'http://127.0.0.1:8080', timeoutMs: 10000 },
    { id: 'query', action: 'fill', selector: '[data-testid=search]', value: 'nova', timeoutMs: 5000 },
    { id: 'submit', action: 'click', selector: '[data-testid=submit]', timeoutMs: 5000 },
    { id: 'check', action: 'assertText', selector: '[data-testid=result]', contains: 'nova', timeoutMs: 5000 },
    { id: 'capture', action: 'screenshot', artifact: 'result.png', timeoutMs: 5000 },
  ],
};

export const WorkflowPanel: React.FC<WorkflowPanelProps> = ({ activeTab }) => {
  const [workflowJson, setWorkflowJson] = useState(JSON.stringify(defaultWorkflow, null, 2));
  const [status, setStatus] = useState<RunStatus>('idle');
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
  const [stepStates, setStepStates] = useState<Record<string, { status: string; error?: string }>>({});
  const [reports, setReports] = useState<RunReport[]>([]);
  const [viewMode, setViewMode] = useState<'editor' | 'reports'>('editor');

  useEffect(() => {
    const unsubStep = (window as any).nova?.automation?.onStepUpdate((data: any) => {
      if (data.tabId === activeTab?.id) {
        setCurrentStepIndex(data.stepIndex);
        setStepStates((prev) => ({
          ...prev,
          [data.step.id]: { status: data.step.status, error: data.step.error },
        }));
      }
    });

    const unsubStatus = (window as any).nova?.automation?.onStatusChange((data: any) => {
      if (data.tabId === activeTab?.id) {
        setStatus(data.status);
      }
    });

    loadReports();

    return () => {
      unsubStep?.();
      unsubStatus?.();
    };
  }, [activeTab?.id]);

  const loadReports = async () => {
    try {
      const data = await (window as any).nova?.automation?.getReports();
      if (data) setReports(data);
    } catch {}
  };

  const handleRun = async () => {
    if (!activeTab) return;
    try {
      const parsed: Workflow = JSON.parse(workflowJson);
      setStatus('running');
      setStepStates({});
      await (window as any).nova.automation.run(activeTab.id, parsed);
      loadReports();
    } catch (err: any) {
      alert(`Invalid Workflow JSON: ${err.message}`);
      setStatus('failed');
    }
  };

  const handlePause = () => {
    if (activeTab) (window as any).nova.automation.pause(activeTab.id);
  };

  const handleResume = () => {
    if (activeTab) (window as any).nova.automation.resume(activeTab.id);
  };

  const handleStop = () => {
    if (activeTab) (window as any).nova.automation.stop(activeTab.id);
  };

  let parsedSteps: any[] = [];
  try {
    parsedSteps = JSON.parse(workflowJson).steps || [];
  } catch {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
      {/* Run Control Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {status === 'running' ? (
            <button className="primary-btn" onClick={handlePause} style={{ background: 'var(--accent-amber)' }}>
              <Pause size={14} />
              <span>พัก (Pause)</span>
            </button>
          ) : status === 'paused' ? (
            <button className="primary-btn" onClick={handleResume} style={{ background: 'var(--accent-emerald)' }}>
              <Play size={14} />
              <span>ทำต่อ (Resume)</span>
            </button>
          ) : (
            <button className="primary-btn" onClick={handleRun} style={{ background: 'var(--accent-emerald)' }}>
              <Play size={14} />
              <span>เริ่มรัน (Run)</span>
            </button>
          )}

          <button
            className="secondary-btn"
            disabled={status === 'idle' || status === 'completed' || status === 'failed'}
            onClick={handleStop}
          >
            <Square size={13} style={{ color: 'var(--accent-rose)' }} />
            <span>หยุด (Stop)</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className={`icon-btn ${viewMode === 'editor' ? 'active' : ''}`}
            onClick={() => setViewMode('editor')}
            title="แก้ไข Workflow"
          >
            <FileText size={15} />
          </button>
          <button
            className={`icon-btn ${viewMode === 'reports' ? 'active' : ''}`}
            onClick={() => {
              setViewMode('reports');
              loadReports();
            }}
            title="ประวัติการรันและรายงานผล"
          >
            <History size={15} />
          </button>
        </div>
      </div>

      {viewMode === 'editor' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
          {/* Step Visualizer */}
          <div className="card">
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
              ขั้นตอนใน Workflow ({parsedSteps.length} steps)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {parsedSteps.map((step, idx) => {
                const state = stepStates[step.id];
                const isRunning = state?.status === 'running';
                const isCompleted = state?.status === 'completed';
                const isFailed = state?.status === 'failed';

                return (
                  <div
                    key={step.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      background: isRunning ? 'rgba(99, 102, 241, 0.2)' : isFailed ? 'rgba(244, 63, 94, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                      borderLeft: `3px solid ${isRunning ? 'var(--accent-primary)' : isCompleted ? 'var(--accent-emerald)' : isFailed ? 'var(--accent-rose)' : 'var(--border-subtle)'}`,
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                  >
                    {isRunning && <Loader2 size={13} className="animate-spin text-cyan" />}
                    {isCompleted && <CheckCircle2 size={13} style={{ color: 'var(--accent-emerald)' }} />}
                    {isFailed && <AlertCircle size={13} style={{ color: 'var(--accent-rose)' }} />}
                    {!isRunning && !isCompleted && !isFailed && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '16px' }}>{idx + 1}.</span>
                    )}

                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{step.action}</span>
                    <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {step.selector || step.url || step.artifact || ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* JSON Editor */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Workflow JSON Definition</span>
              <button
                className="secondary-btn"
                style={{ padding: '2px 8px', fontSize: '10px' }}
                onClick={() => setWorkflowJson(JSON.stringify(defaultWorkflow, null, 2))}
              >
                <RotateCcw size={11} />
                <span>รีเซ็ตตัวอย่าง</span>
              </button>
            </div>
            <textarea
              style={{
                flex: 1,
                minHeight: '180px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                padding: '8px',
                resize: 'none',
                outline: 'none',
              }}
              value={workflowJson}
              onChange={(e) => setWorkflowJson(e.target.value)}
              spellCheck={false}
            />
          </div>
        </div>
      ) : (
        /* Reports View */
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {reports.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px', fontSize: '13px' }}>
              ยังไม่มีรายงานผลการรัน
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.runId} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '12px' }}>{r.workflowName}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: r.status === 'completed' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                    }}
                  >
                    {r.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  เวลา: {new Date(r.startedAt).toLocaleTimeString()} | ระยะเวลา: {r.finishedAt - r.startedAt}ms | ขั้นตอน: {r.steps.length}
                </div>
                {r.artifacts.length > 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', marginTop: '4px' }}>
                    Artifacts: {r.artifacts.length} รายการ
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
