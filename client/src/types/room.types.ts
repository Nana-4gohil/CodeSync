// ─── Room types ───────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  language: string;
  isPublic: boolean;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomMember {
  userId: string;
  username: string;
  avatarColor: string;
  role: 'owner' | 'editor' | 'viewer';
  online?: boolean;
}

export interface CreateRoomPayload {
  name: string;
  description?: string;
  language: string;
  isPublic: boolean;
}
