import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../../config/socket';
import { useEditorStore } from '../../store/editorStore';
import { useAuthStore } from '../../store/authStore';
import { EditorRemoteChangePayload, EditorRemoteCursorPayload } from '../../types/socket.types';

// Re-export socket payload types
export interface RemoteCursor {
  userId: string;
  username: string;
  color: string;
  position: { lineNumber: number; column: number };
}

interface UseCollaborationOptions {
  roomId: string;
  fileId: string | null;
  onRemoteChange?: (payload: EditorRemoteChangePayload) => void;
  onRemoteCursor?: (cursor: RemoteCursor) => void;
}

export function useCollaboration({
  roomId,
  fileId,
  onRemoteChange,
  onRemoteCursor,
}: UseCollaborationOptions) {
  const socket = getSocket();
  const { user } = useAuthStore();
  const updateFileContent = useEditorStore((s) => s.updateFileContent);
  const versionRef = useRef<number>(Date.now());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Emit code change (debounced 300ms) ─────────────────────────────────────
  const emitChange = useCallback(
    (content: string) => {
      if (!fileId) return;

      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      debounceTimer.current = setTimeout(() => {
        const version = ++versionRef.current;
        socket.emit('editor:change', { roomId, fileId, content, version });
      }, 300);
    },
    [socket, roomId, fileId],
  );

  // ── Emit cursor position ────────────────────────────────────────────────────
  const emitCursor = useCallback(
    (position: { lineNumber: number; column: number }) => {
      if (!fileId) return;
      socket.emit('editor:cursor', { roomId, fileId, position });
    },
    [socket, roomId, fileId],
  );

  // ── Emit typing indicator ───────────────────────────────────────────────────
  const emitTyping = useCallback(() => {
    if (!fileId) return;
    socket.emit('editor:typing', { roomId, fileId });
  }, [socket, roomId, fileId]);

  // ── Listen for remote changes ───────────────────────────────────────────────
  useEffect(() => {
    const handleRemoteChange = (payload: EditorRemoteChangePayload) => {
      if (payload.userId === user?.id) return; // ignore own echoes
      if (payload.fileId !== fileId) return;

      updateFileContent(payload.fileId, payload.content);
      onRemoteChange?.(payload);
    };

    const handleRemoteCursor = (payload: EditorRemoteCursorPayload) => {
      if (payload.userId === user?.id) return;
      if (payload.fileId !== fileId) return;
      onRemoteCursor?.({ ...payload });
    };

    socket.on('editor:remote-change', handleRemoteChange);
    socket.on('editor:remote-cursor', handleRemoteCursor);

    return () => {
      socket.off('editor:remote-change', handleRemoteChange);
      socket.off('editor:remote-cursor', handleRemoteCursor);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [socket, fileId, user?.id, onRemoteChange, onRemoteCursor, updateFileContent]);

  return { emitChange, emitCursor, emitTyping };
}
