// ─── Room types ───────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  language: string;
  is_public: boolean;
  invite_code: string;
  created_at: string;
  updated_at: string;
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
