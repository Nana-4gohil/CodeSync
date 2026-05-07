import React, { useState } from 'react';
import { executionService } from './executionService';
import { Spinner } from '../../components/ui/Spinner';

interface TerminalPanelProps {
  code: string;
  language: string;
}

interface OutputEntry {
  type: 'stdout' | 'stderr' | 'info' | 'time';
  text: string;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ code, language }) => {
  const [output, setOutput] = useState<OutputEntry[]>([]);
  const [running, setRunning] = useState(false);

  async function runCode() {
    if (running || !code.trim()) return;

    setOutput([{ type: 'info', text: `▶ Running ${language}…` }]);
    setRunning(true);

    try {
      const result = await executionService.execute(code, language);

      const entries: OutputEntry[] = [];

      if (result.stdout) {
        result.stdout.split('\n').forEach((line) => {
          entries.push({ type: 'stdout', text: line });
        });
      }

      if (result.stderr) {
        result.stderr.split('\n').forEach((line) => {
          entries.push({ type: 'stderr', text: line });
        });
      }

      if (entries.length === 0) {
        entries.push({ type: 'info', text: '(no output)' });
      }

      entries.push({ type: 'time', text: `⏱ ${result.executionTime}ms` });
      setOutput((prev) => [...prev, ...entries]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Execution failed';
      setOutput((prev) => [...prev, { type: 'stderr', text: msg }]);
    } finally {
      setRunning(false);
    }
  }

  const colorMap: Record<string, string> = {
    stdout: '#d4d4d4',
    stderr: '#f87171',
    info: '#6366f1',
    time: '#888',
  };

  return (
    <div className="flex flex-col h-full bg-surface-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-editor-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#bbb]">Terminal</span>
          {running && <Spinner size="xs" />}
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
            disabled={running || !code.trim()}
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
            Press <kbd className="bg-white/10 px-1 py-0.5 rounded text-[#888]">Run</kbd> to execute the active file
          </div>
        ) : (
          output.map((entry, idx) => (
            <div
              key={idx}
              style={{ color: colorMap[entry.type] }}
              className="whitespace-pre-wrap break-all"
            >
              {entry.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
