import { api } from '../../config/api';
import { CreateRoomPayload } from '../../types/room.types';

export const roomService = {
  async getRooms() {
    const { data } = await api.get('/rooms');
    return data.data;
  },

  async createRoom(payload: CreateRoomPayload) {
    const { data } = await api.post('/rooms', payload);
    return data.data;
  },

  async getRoom(roomId: string) {
    const { data } = await api.get(`/rooms/${roomId}`);
    return data.data;
  },

  async joinByInvite(inviteCode: string) {
    const { data } = await api.post('/rooms/join', { inviteCode });
    return data.data;
  },

  async getMembers(roomId: string) {
    const { data } = await api.get(`/rooms/${roomId}/members`);
    return data.data;
  },

  async deleteRoom(roomId: string) {
    await api.delete(`/rooms/${roomId}`);
  },

  async leaveRoom(roomId: string) {
    await api.post(`/rooms/${roomId}/leave`);
  },

  async updateRoom(roomId: string, payload: { name?: string; description?: string; language?: string; isPublic?: boolean }) {
    const { data } = await api.patch(`/rooms/${roomId}`, payload);
    return data.data;
  },

  async regenerateInvite(roomId: string) {
    const { data } = await api.post(`/rooms/${roomId}/regenerate-invite`);
    return data.data.inviteCode as string;
  },
};
