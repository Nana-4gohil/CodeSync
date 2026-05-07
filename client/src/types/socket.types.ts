// Socket payload types mirroring the server types

export interface EditorRemoteChangePayload {
  roomId: string;
  fileId: string;
  content: string;
  version: number;
  userId: string;
  username: string;
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
