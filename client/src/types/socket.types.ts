// Socket payload types mirroring the server types

// ── OT operation (character-offset based) ────────────────────────────────────
// Mirrors client/src/features/editor/ot.ts  OTOp
export interface OTOp {
  type: 'insert' | 'delete';
  pos: number;
  text?: string; // insert only
  len?: number;  // delete only
}

export interface EditorRemoteChangePayload {
  roomId: string;
  fileId: string;
  operations: OTOp[];
  revision: number; // server revision after applying this op
  userId: string;
  username: string;
}

export interface EditorAckPayload {
  fileId: string;
  revision: number; // server revision at which the client's op was applied
}


export interface EditorRemoteCursorPayload {
  roomId: string;
  fileId: string;
  position: { lineNumber: number; column: number };
  userId: string;
  username: string;
  color: string;
}

export interface ChatMessagePayload {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatarColor: string;
  content: string;
  createdAt: string;
}

export interface RoomMemberPayload {
  userId: string;
  username: string;
  avatarColor: string;
  role: string;
}

// ── Filesystem real-time sync ─────────────────────────────────────────────────
export interface FsFileCreatedPayload {
  file: import('./file.types').EditorFile;
  createdBy: string;
}
export interface FsFileRenamedPayload {
  fileId: string;
  name: string;
  path: string;
  renamedBy: string;
}
export interface FsFileDeletedPayload {
  fileId: string;
  deletedBy: string;
}
