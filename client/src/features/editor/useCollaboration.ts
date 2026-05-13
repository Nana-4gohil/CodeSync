import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../../config/socket';
import { useAuthStore } from '../../store/authStore';
import { OTOp, EditorRemoteChangePayload, EditorAckPayload, EditorRemoteCursorPayload } from '../../types/socket.types';
import { transformOp, transformOpsAgainst } from './ot';

export type { OTOp };

// Re-export cursor type
export interface RemoteCursor {
  userId: string;
  username: string;
  color: string;
  position: { lineNumber: number; column: number };
}

interface UseCollaborationOptions {
  roomId: string;
  fileId: string | null;
  onRemoteChange?: (ops: OTOp[], revision: number) => void;
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

  // ── OT client state machine ─────────────────────────────────────────────────
  // clientRevision: last server revision we know about (0 = initial)
  const clientRevision = useRef<number>(0);
  // pendingOps: ops we have sent to the server but not yet ACK'd.
  // These must be transformed against any remote op we receive.
  const pendingOps = useRef<OTOp[]>([]);
  // sendQueue: ops buffered while we wait for the in-flight ACK
  const sendQueue = useRef<OTOp[]>([]);
  // awaitingAck: true while we have an unacknowledged outgoing op
  const awaitingAck = useRef<boolean>(false);

  // ── Internal: flush the send queue when previous op is ACK'd ────────────────
  const flushQueue = useCallback(() => {
    if (sendQueue.current.length === 0) {
      awaitingAck.current = false;
      return;
    }
    const ops = sendQueue.current;
    sendQueue.current = [];
    pendingOps.current = ops;
    awaitingAck.current = true;
    socket.emit('editor:change', {
      roomId,
      fileId,
      revision: clientRevision.current,
      operations: ops,
    });
  }, [socket, roomId, fileId]);

  // ── emitChange: send OT ops to server (or buffer if waiting for ACK) ────────
  const emitChange = useCallback(
    (ops: OTOp[]) => {
      if (!fileId || ops.length === 0) return;

      if (awaitingAck.current) {
        // Buffer: compose into the existing send queue.
        // The queue will be sent as one batch once the ACK arrives.
        sendQueue.current = [...sendQueue.current, ...ops];
        return;
      }

      pendingOps.current = ops;
      awaitingAck.current = true;
      socket.emit('editor:change', {
        roomId,
        fileId,
        revision: clientRevision.current,
        operations: ops,
      });
    },
    [socket, roomId, fileId],
  );

  // ── emitCursor ───────────────────────────────────────────────────────────────
  const emitCursor = useCallback(
    (position: { lineNumber: number; column: number }) => {
      if (!fileId) return;
      socket.emit('editor:cursor', { roomId, fileId, position });
    },
    [socket, roomId, fileId],
  );

  // ── emitTyping ───────────────────────────────────────────────────────────────
  const emitTyping = useCallback(() => {
    if (!fileId) return;
    socket.emit('editor:typing', { roomId, fileId });
  }, [socket, roomId, fileId]);

  // ── Socket listeners ─────────────────────────────────────────────────────────
  useEffect(() => {
    // ── editor:ack ──────────────────────────────────────────────────────────
    const handleAck = ({ fileId: ackFileId, revision }: EditorAckPayload) => {
      if (ackFileId !== fileId) return;
      clientRevision.current = revision;
      pendingOps.current = [];
      flushQueue();
    };

    // ── editor:remote-change ────────────────────────────────────────────────
    const handleRemoteChange = (payload: EditorRemoteChangePayload) => {
      if (payload.userId === user?.id) return;
      if (payload.fileId !== fileId) return;

      clientRevision.current = payload.revision;

      let incomingOps = payload.operations;

      if (pendingOps.current.length > 0 || sendQueue.current.length > 0) {
        // All unacknowledged local ops, in the order the server will see them:
        // first the in-flight batch (pendingOps), then the buffered ones (sendQueue).
        const allLocalOps = [...pendingOps.current, ...sendQueue.current];

        // 1. Transform incoming ops PAST all local ops so they can be applied
        //    to the client's current document state.
        incomingOps = transformOpsAgainst(incomingOps, allLocalOps);

        // 2. Transform the local ops past the incoming ops so their positions
        //    stay correct after the remote edit is applied.
        const newPending = transformOpsAgainst(pendingOps.current, payload.operations);
        const newQueue   = transformOpsAgainst(sendQueue.current,  payload.operations);
        pendingOps.current = newPending;
        sendQueue.current  = newQueue;
      }

      onRemoteChange?.(incomingOps, payload.revision);
    };

    // ── editor:remote-cursor ────────────────────────────────────────────────
    const handleRemoteCursor = (payload: EditorRemoteCursorPayload) => {
      if (payload.userId === user?.id) return;
      if (payload.fileId !== fileId) return;
      onRemoteCursor?.({ ...payload });
    };

    socket.on('editor:ack', handleAck);
    socket.on('editor:remote-change', handleRemoteChange);
    socket.on('editor:remote-cursor', handleRemoteCursor);

    return () => {
      socket.off('editor:ack', handleAck);
      socket.off('editor:remote-change', handleRemoteChange);
      socket.off('editor:remote-cursor', handleRemoteCursor);
    };
  }, [socket, fileId, user?.id, onRemoteChange, onRemoteCursor, flushQueue]);

  // Reset OT state when file changes
  useEffect(() => {
    clientRevision.current = 0;
    pendingOps.current = [];
    sendQueue.current = [];
    awaitingAck.current = false;
  }, [fileId]);

  return { emitChange, emitCursor, emitTyping };
}
