import React, { useRef, useEffect, useCallback } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { useEditorStore } from '../../store/editorStore';
import { useCollaboration, RemoteCursor } from './useCollaboration';

interface CodeEditorProps {
  roomId: string;
  fileId: string;
  content: string;
  language: string;
  readOnly?: boolean;
}

// Map userId → IEditorDecorationsCollection for cursor overlays
const decorationMap = new Map<string, editor.IEditorDecorationsCollection>();

export const CodeEditor: React.FC<CodeEditorProps> = ({
  roomId,
  fileId,
  content,
  language,
  readOnly = false,
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const updateFileContent = useEditorStore((s) => s.updateFileContent);
  const isRemoteUpdate = useRef(false);

  // ── Handle remote cursor overlay ───────────────────────────────────────────
  const handleRemoteCursor = useCallback((cursor: RemoteCursor) => {
    if (!editorRef.current || !monacoRef.current) return;

    // Remove old decoration for this user
    const old = decorationMap.get(cursor.userId);
    if (old) old.clear();

    const model = editorRef.current.getModel();
    if (!model) return;

    const lineCount = model.getLineCount();
    if (cursor.position.lineNumber > lineCount) return;

    const newDecoration = editorRef.current.createDecorationsCollection([{
      range: new monacoRef.current.Range(
        cursor.position.lineNumber,
        cursor.position.column,
        cursor.position.lineNumber,
        cursor.position.column + 1,
      ),
      options: {
        className: `remote-cursor-${cursor.userId.slice(0, 8)}`,
        beforeContentClassName: 'remote-cursor-flag',
        stickiness: monacoRef.current.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        hoverMessage: { value: `**${cursor.username}**` },
      },
    }]);

    decorationMap.set(cursor.userId, newDecoration);

    // Inject dynamic CSS for cursor color
    const styleId = `cursor-style-${cursor.userId.slice(0, 8)}`;
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .remote-cursor-${cursor.userId.slice(0, 8)} {
          border-left: 2px solid ${cursor.color};
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const { emitChange, emitCursor, emitTyping } = useCollaboration({
    roomId,
    fileId,
    onRemoteChange: () => {
      // Content is already updated in the store by the hook.
      // We need to sync the Monaco editor model.
      if (!editorRef.current) return;
      const store = useEditorStore.getState();
      const file = store.files.find((f) => f.id === fileId);
      if (!file) return;

      const currentValue = editorRef.current.getValue();
      if (currentValue !== file.content) {
        isRemoteUpdate.current = true;
        const model = editorRef.current.getModel();
        if (model) {
          // Preserve cursor position
          const position = editorRef.current.getPosition();
          model.setValue(file.content);
          if (position) editorRef.current.setPosition(position);
        }
        isRemoteUpdate.current = false;
      }
    },
    onRemoteCursor: handleRemoteCursor,
  });

  // ── Sync content changes from store to editor ──────────────────────────────
  useEffect(() => {
    if (!editorRef.current || isRemoteUpdate.current) return;
    const currentValue = editorRef.current.getValue();
    if (currentValue !== content) {
      const model = editorRef.current.getModel();
      if (model) {
        const pos = editorRef.current.getPosition();
        model.setValue(content);
        if (pos) editorRef.current.setPosition(pos);
      }
    }
  }, [content]);

  const handleEditorMount: OnMount = (editorInstance, monacoInstance) => {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;

    // Cursor position change → emit cursor event
    editorInstance.onDidChangeCursorPosition((e) => {
      if (!isRemoteUpdate.current) {
        emitCursor({
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        });
      }
    });

    // Configure editor options
    editorInstance.updateOptions({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontLigatures: true,
      lineHeight: 22,
      minimap: { enabled: true, scale: 1 },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      renderLineHighlight: 'gutter',
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true },
      padding: { top: 12, bottom: 12 },
      suggest: { showIcons: true },
      renderWhitespace: 'selection',
    });
  };

  const handleChange = (value: string | undefined) => {
    if (isRemoteUpdate.current || !value === undefined) return;
    const newContent = value ?? '';
    updateFileContent(fileId, newContent);
    emitChange(newContent);
    emitTyping();
  };

  return (
    <div className="w-full h-full">
      <Editor
        height="100%"
        language={language}
        value={content}
        theme="vs-dark"
        onMount={handleEditorMount}
        onChange={handleChange}
        options={{
          readOnly,
          automaticLayout: true,
        }}
        loading={
          <div className="flex items-center justify-center h-full bg-editor-bg">
            <div className="text-[#555] text-sm">Loading editor…</div>
          </div>
        }
      />
    </div>
  );
};
