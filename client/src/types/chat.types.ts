// ─── Chat types ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatarColor: string;
  content: string;
  createdAt: string;
}
