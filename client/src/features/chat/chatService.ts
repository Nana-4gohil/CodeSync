import { api } from '../../config/api';

export const chatService = {
  async getMessages(roomId: string, limit = 50, before?: string) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.append('before', before);

    const { data } = await api.get(`/rooms/${roomId}/messages?${params}`);
    return data.data;
  },
};
