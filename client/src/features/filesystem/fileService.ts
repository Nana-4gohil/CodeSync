import { api } from '../../config/api';

export const fileService = {
  async getFiles(roomId: string) {
    const { data } = await api.get(`/rooms/${roomId}/files`);
    return data.data;
  },

  async getFile(roomId: string, fileId: string) {
    const { data } = await api.get(`/rooms/${roomId}/files/${fileId}`);
    return data.data;
  },

  async createFile(roomId: string, payload: { name: string; path: string; content?: string; language?: string }) {
    const { data } = await api.post(`/rooms/${roomId}/files`, payload);
    return data.data;
  },

  async updateContent(roomId: string, fileId: string, content: string) {
    const { data } = await api.patch(`/rooms/${roomId}/files/${fileId}/content`, { content });
    return data.data;
  },

  async renameFile(roomId: string, fileId: string, name: string, path: string) {
    const { data } = await api.patch(`/rooms/${roomId}/files/${fileId}/rename`, { name, path });
    return data.data;
  },

  async deleteFile(roomId: string, fileId: string) {
    await api.delete(`/rooms/${roomId}/files/${fileId}`);
  },
};
