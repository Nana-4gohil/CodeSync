import React, { useState, useEffect, useRef } from 'react';
import { executionService } from './executionService';
import { Spinner } from '../../components/ui/Spinner';
import { getSocket } from '../../config/socket';

interface TerminalPanelProps {
  roomId: string;
  fileId: string;
  code: string;
  language: string;
}

interface OutputEntry {
  type: 'stdout' | 'stderr' | 'info' | 'time' | 'divider';
  text: string;
}

interface RemoteResultPayload {
  roomId: string;
  fileId: string;
  language: string;
  stdout: string;
  stderr: string;
  executionTime: number;
  success: boolean;
  triggeredBy: string;
}

interface RemoteRunningPayload {
  language: string;
  triggeredBy: string;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ roomId, fileId, code, language }) => {
  const [output, setOutput] = useState<OutputEntry[]>([]);
  const [running, setRunning]   = useState(false);
  const [remoteRunner, setRemoteRunner] = useState<string | null>(null); // username of remote runner
  const bottomRef = useRef<HTMLDivElement>(null);
  const socket = getSocket();

  // Auto-scroll to bottom whenever output changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  // ── Listen for remote execution events ────────────────────────────────────
  useEffect(() => {
    const onRemoteRunning = ({ language: lang, triggeredBy }: RemoteRunningPayload) => {
      setRemoteRunner(triggeredBy);
      setOutput((prev) => [
        ...prev,
        { type: 'divider', text: '' },
        { type: 'info', text: `▶ ${triggeredBy} is running ${lang}…` },
      ]);
    };

    const onRemoteResult = ({
      stdout, stderr, executionTime, success, triggeredBy, language: lang,
    }: RemoteResultPayload) => {
      setRemoteRunner(null);
      const entries: OutputEntry[] = [];

      if (stdout) stdout.split('\n').forEach((line) => entries.push({ type: 'stdout', text: line }));
      if (stderr) stderr.split('\n').forEach((line) => entries.push({ type: 'stderr', text: line }));
      if (entries.length === 0) entries.push({ type: 'info', text: '(no output)' });
      entries.push({ type: 'time', text: `⏱ ${executionTime}ms  ·  ${success ? '✓ exit 0' : '✗ non-zero exit'}` });

      setOutput((prev) => [...prev, ...entries]);
    };

    socket.on('execution:remote-running', onRemoteRunning);
    socket.on('execution:remote-result', onRemoteResult);
    return () => {
      socket.off('execution:remote-running', onRemoteRunning);
      socket.off('execution:remote-result', onRemoteResult);
    };
  }, [socket]);

  // ── Run code (local user) ──────────────────────────────────────────────────
  async function runCode() {
    if (running || !code.trim()) return;

    // Tell peers we're running
    socket.emit('execution:running', { roomId, fileId, language });

    setOutput((prev) => [
      ...prev,
      { type: 'divider', text: '' },
      { type: 'info', text: `▶ Running ${language}…` },
    ]);
    setRunning(true);

    try {
      const result = await executionService.execute(code, language);
      const entries: OutputEntry[] = [];

      if (result.stdout) result.stdout.split('\n').forEach((line) => entries.push({ type: 'stdout', text: line }));
      if (result.stderr) result.stderr.split('\n').forEach((line) => entries.push({ type: 'stderr', text: line }));
      if (entries.length === 0) entries.push({ type: 'info', text: '(no output)' });
      entries.push({
        type: 'time',
        text: `⏱ ${result.executionTime}ms  ·  ${result.success ? '✓ exit 0' : '✗ non-zero exit'}`,
      });

      setOutput((prev) => [...prev, ...entries]);

      // Broadcast result to peers
      socket.emit('execution:result', {
        roomId,
        fileId,
        language,
        stdout: result.stdout,
        stderr: result.stderr,
        executionTime: result.executionTime,
        success: result.success,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Execution failed';
      setOutput((prev) => [...prev, { type: 'stderr', text: msg }]);
      socket.emit('execution:result', {
        roomId, fileId, language,
        stdout: '', stderr: msg, executionTime: 0, success: false,
      });
    } finally {
      setRunning(false);
    }
  }

  const colorMap: Record<string, string> = {
    stdout:  '#d4d4d4',
    stderr:  '#f87171',
    info:    '#6366f1',
    time:    '#666',
    divider: 'transparent',
  };

  const isRunning = running || !!remoteRunner;
  const runnerLabel = remoteRunner ? `${remoteRunner} is running…` : 'Running…';

  return (
    <div className="flex flex-col h-full bg-surface-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-editor-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#bbb]">Terminal</span>
          {isRunning && (
            <span className="flex items-center gap-1 text-[10px] text-[#6366f1]">
              <Spinner size="xs" />
              {remoteRunner ? runnerLabel : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOutput([])}
            className="text-xs text-[#666] hover:text-[#ccc] transition-colors"
            title="Clear output"
          >
            Clear
          </button>
          <button
            id="run-code-btn"
            onClick={runCode}
            disabled={isRunning || !code.trim()}
            className="flex items-center gap-1.5 px-3 py-1 bg-brand-600 hover:bg-brand-500
                       disabled:opacity-50 disabled:cursor-not-allowed rounded text-white text-xs
                       transition-colors font-medium"
          >
            {running ? (
              <Spinner size="xs" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            {running ? 'Running…' : 'Run'}
          </button>
        </div>
      </div>

      {/* Output */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
        {output.length === 0 ? (
          <div className="text-[#555] text-xs">
            Press <kbd className="bg-white/10 px-1 py-0.5 rounded text-[#888]">Run</kbd> to execute
            the active file — output is shared with all room members
          </div>
        ) : (
          output.map((entry, idx) =>
            entry.type === 'divider' ? (
              <div key={idx} className="border-t border-white/5 my-2" />
            ) : (
              <div
                key={idx}
                style={{ color: colorMap[entry.type] }}
                className="whitespace-pre-wrap break-all"
              >
                {entry.text}
              </div>
            )
          )
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
