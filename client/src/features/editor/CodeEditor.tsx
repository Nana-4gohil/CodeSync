import React, { useRef, useEffect, useCallback } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import toast from 'react-hot-toast';
import { useEditorStore } from '../../store/editorStore';
import { useCollaboration, RemoteCursor, OTOp } from './useCollaboration';
import { fileService } from '../filesystem/fileService';

interface CodeEditorProps {
  roomId: string;
  fileId: string;
  content: string;
  language: string;
  readOnly?: boolean;
  onSave?: () => void;
}

// NOTE: Maps are now component-level useRefs (see below) — not module-level —
// so switching files clears stale remote cursors automatically.

export const CodeEditor: React.FC<CodeEditorProps> = ({
  roomId,
  fileId,
  content,
  language,
  readOnly = false,
  onSave,
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const { updateFileContent, markClean } = useEditorStore();
  const isRemoteUpdate = useRef(false);
  const isSaving = useRef(false);

  // Per-component maps — isolated per editor instance, cleared on file switch
  const decorationMapRef = useRef(new Map<string, editor.IEditorDecorationsCollection>());
  const widgetMapRef     = useRef(new Map<string, editor.IContentWidget>());
  // Mutable position objects shared with each widget's getPosition() closure.
  // Mutating these + calling layoutContentWidget moves the label without
  // remove/add overhead — critical for keeping labels in sync after remote edits.
  const remoteWidgetPosRef = useRef(new Map<string, { lineNumber: number; column: number }>());

  // ── Always-fresh refs so stale closures (addCommand) read current props ────
  const fileIdRef = useRef(fileId);
  const roomIdRef = useRef(roomId);
  useEffect(() => { fileIdRef.current = fileId; }, [fileId]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  // ── Clear all remote cursors when the active file changes ─────────────────────
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        widgetMapRef.current.forEach((w) => editorRef.current!.removeContentWidget(w));
      }
      widgetMapRef.current.clear();
      remoteWidgetPosRef.current.clear();
      decorationMapRef.current.forEach((d) => d.clear());
      decorationMapRef.current.clear();
    };
  }, [fileId]);

  // ── Recompute label horizontal offsets for all users on a given line ─────────
  // Called whenever any cursor moves to/from a line so collision offsets stay
  // accurate even after users separate.
  const recomputeLineOffsets = useCallback((lineNumber: number) => {
    const widgetMap = widgetMapRef.current;
    const usersOnLine: Array<{ uid: string; col: number }> = [];
    for (const [uid, w] of widgetMap.entries()) {
      const pos = w.getPosition()?.position;
      if (pos && pos.lineNumber === lineNumber) usersOnLine.push({ uid, col: pos.column });
    }
    // Stable sort: left-to-right by column, then by userId
    usersOnLine.sort((a, b) => a.col - b.col || a.uid.localeCompare(b.uid));
    usersOnLine.forEach(({ uid }, index) => {
      const node = widgetMap.get(uid)?.getDomNode() as HTMLElement | undefined;
      if (node) node.style.marginLeft = index === 0 ? '' : `${index * 76}px`;
    });
  }, []);

  // ── Handle remote cursor overlay with username label ──────────────────────
  const handleRemoteCursor = useCallback((cursor: RemoteCursor) => {
    if (!editorRef.current || !monacoRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const lineCount = model.getLineCount();
    if (cursor.position.lineNumber > lineCount) return;

    const shortId    = cursor.userId.slice(0, 8);
    const decorationMap = decorationMapRef.current;
    const widgetMap     = widgetMapRef.current;
    const posMap        = remoteWidgetPosRef.current;

    // ── 1. Remember old line BEFORE removing widget (needed to clear offsets) ─
    const oldWidget = widgetMap.get(cursor.userId);
    const oldLine   = oldWidget?.getPosition()?.position?.lineNumber ?? null;

    // ── 2. Cursor caret decoration ────────────────────────────────────────────
    decorationMap.get(cursor.userId)?.clear();
    decorationMap.set(
      cursor.userId,
      editorRef.current.createDecorationsCollection([{
        range: new monacoRef.current.Range(
          cursor.position.lineNumber, cursor.position.column,
          cursor.position.lineNumber, cursor.position.column,
        ),
        options: {
          className: `remote-cursor-caret-${shortId}`,
          stickiness: monacoRef.current.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          hoverMessage: { value: `**${cursor.username}**` },
        },
      }]),
    );

    // ── 3. Reuse existing widget if possible — just mutate its position ────────
    const existingMutablePos = posMap.get(cursor.userId);
    if (existingMutablePos && oldWidget) {
      existingMutablePos.lineNumber = cursor.position.lineNumber;
      existingMutablePos.column     = cursor.position.column;
      editorRef.current.layoutContentWidget(oldWidget);
    } else {
      // First time for this user → build DOM + register widget
      if (oldWidget) editorRef.current.removeContentWidget(oldWidget);

      const mutablePos = { lineNumber: cursor.position.lineNumber, column: cursor.position.column };
      posMap.set(cursor.userId, mutablePos);

      const labelNode = document.createElement('div');
      labelNode.setAttribute('data-remote-label', cursor.userId);
      Object.assign(labelNode.style, {
        backgroundColor: cursor.color,
        color: '#000',
        fontSize: '10px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '700',
        padding: '1px 6px',
        borderRadius: '3px 3px 3px 0',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        userSelect: 'none',
        lineHeight: '16px',
        marginBottom: '2px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      });
      labelNode.textContent = cursor.username;

      const capturedPos = mutablePos;          // stable ref for getPosition closure
      const monaco      = monacoRef.current;
      const widget: editor.IContentWidget = {
        getId:      () => `remote-cursor-widget-${cursor.userId}`,
        getDomNode: () => labelNode,
        getPosition: () => ({
          position:   { lineNumber: capturedPos.lineNumber, column: capturedPos.column },
          preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE],
        }),
      };
      editorRef.current.addContentWidget(widget);
      widgetMap.set(cursor.userId, widget);

      // Inject caret CSS once per user
      const styleId = `cursor-style-${shortId}`;
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .remote-cursor-caret-${shortId} {
            border-left: 2px solid ${cursor.color};
            margin-left: -1px;
          }
        `;
        document.head.appendChild(style);
      }
    }

    // ── 4. Recompute label offsets for old + new line ─────────────────────────
    // This ensures that when users move apart, the remaining user's label
    // loses its horizontal offset immediately.
    const newLine = cursor.position.lineNumber;
    if (oldLine !== null && oldLine !== newLine) recomputeLineOffsets(oldLine);
    recomputeLineOffsets(newLine);
  }, [recomputeLineOffsets]);

  const { emitChange, emitCursor, emitTyping } = useCollaboration({
    roomId,
    fileId,
    onRemoteChange: (ops: OTOp[]) => {
      if (!editorRef.current || ops.length === 0) return;
      const model = editorRef.current.getModel();
      if (!model) return;

      // ── Snapshot remote cursor char-offsets BEFORE the model changes ────────
      // After applyEdits we transform these offsets through the same ops so
      // each label follows content shifts (e.g. a line deleted above S1 moves
      // S1's label up without waiting for the next cursor event from S1).
      const posMap = remoteWidgetPosRef.current;
      const savedOffsets = new Map<string, number>();
      posMap.forEach((p, uid) => {
        savedOffsets.set(uid, model.getOffsetAt({ lineNumber: p.lineNumber, column: p.column }));
      });

      isRemoteUpdate.current = true;
      model.applyEdits(
        ops.map((op) => {
          if (op.type === 'insert') {
            const pos = model.getPositionAt(op.pos);
            return {
              range: { startLineNumber: pos.lineNumber, startColumn: pos.column,
                        endLineNumber: pos.lineNumber,   endColumn: pos.column },
              text: op.text!,
              forceMoveMarkers: true,
            };
          } else {
            const start = model.getPositionAt(op.pos);
            const end   = model.getPositionAt(op.pos + op.len!);
            return {
              range: { startLineNumber: start.lineNumber, startColumn: start.column,
                        endLineNumber: end.lineNumber,   endColumn: end.column },
              text: '',
              forceMoveMarkers: true,
            };
          }
        })
      );
      isRemoteUpdate.current = false;

      // ── Transform saved cursor offsets through the applied ops ───────────────
      savedOffsets.forEach((rawOffset, uid) => {
        let offset = rawOffset;
        for (const op of ops) {
          if (op.type === 'insert') {
            if (op.pos <= offset) offset += op.text!.length;
          } else {
            if (op.pos + op.len! <= offset) {
              offset -= op.len!;
            } else if (op.pos <= offset) {
              offset = op.pos; // cursor was inside deleted range — snap to deletion start
            }
          }
        }
        const newPos = model.getPositionAt(offset);
        const mutable = posMap.get(uid);
        if (mutable && (mutable.lineNumber !== newPos.lineNumber || mutable.column !== newPos.column)) {
          mutable.lineNumber = newPos.lineNumber;
          mutable.column     = newPos.column;
          const widget = widgetMapRef.current.get(uid);
          if (widget) editorRef.current!.layoutContentWidget(widget);
        }
      });

      updateFileContent(fileIdRef.current, model.getValue());
    },
    onRemoteCursor: handleRemoteCursor,
  });

  // ── Sync content changes from store to editor ──────────────────────────────
  // IMPORTANT: set isRemoteUpdate=true before calling model.setValue so that
  // Monaco's onChange callback (handleChange) does NOT re-emit an editor:change
  // event for a change that originated from the store, causing an infinite loop
  // that continuously resets the debounce timer and prevents it from ever firing.
  useEffect(() => {
    if (!editorRef.current || isRemoteUpdate.current) return;
    const currentValue = editorRef.current.getValue();
    if (currentValue !== content) {
      const model = editorRef.current.getModel();
      if (model) {
        const pos = editorRef.current.getPosition();
        isRemoteUpdate.current = true;
        model.setValue(content);
        isRemoteUpdate.current = false;
        if (pos) editorRef.current.setPosition(pos);
      }
    }
  }, [content]);

  const handleEditorMount: OnMount = (editorInstance, monacoInstance) => {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;

    // ── Ctrl+S / Cmd+S → Save file to server ──────────────────────────────
    editorInstance.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      async () => {
        if (isSaving.current || readOnly) return;
        isSaving.current = true;
        // Use refs — not closed-over props — so we always save the currently active file
        const currentFileId = fileIdRef.current;
        const currentRoomId = roomIdRef.current;
        const currentContent = editorInstance.getValue();
        try {
          await fileService.updateContent(currentRoomId, currentFileId, currentContent);
          toast.success('File saved', { duration: 1500 });
          markClean(currentFileId);
          onSave?.();
        } catch {
          toast.error('Failed to save file');
        } finally {
          isSaving.current = false;
        }
      },
    );

    // Cursor position change → emit cursor event
    editorInstance.onDidChangeCursorPosition((e) => {
      if (!isRemoteUpdate.current) {
        emitCursor({
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        });
      }
    });

    // Content change → convert to OTOp[] and emit
    // Monaco provides rangeOffset (char offset of range start) and rangeLength
    // (chars replaced) on every change — maps directly to OT insert/delete ops.
    editorInstance.onDidChangeModelContent((e) => {
      if (isRemoteUpdate.current) return;

      const ops: OTOp[] = [];
      for (const change of e.changes) {
        const { rangeOffset, rangeLength, text } = change;
        // A Monaco change = optional delete + optional insert at the same offset
        if (rangeLength > 0) {
          ops.push({ type: 'delete', pos: rangeOffset, len: rangeLength });
        }
        if (text.length > 0) {
          ops.push({ type: 'insert', pos: rangeOffset, text });
        }
      }

      if (ops.length === 0) return;
      updateFileContent(fileIdRef.current, editorInstance.getValue());
      emitChange(ops);
      emitTyping();
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


  return (
    <div className="w-full h-full">
      <Editor
        height="100%"
        language={language}
        value={content}
        theme="vs-dark"
        onMount={handleEditorMount}
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
