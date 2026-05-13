import { create } from 'zustand';
import { Room, RoomMember } from '../types/room.types';

export type ActivityStatus = 'active' | 'idle';

interface RoomStore {
  currentRoom: Room | null;
  members: RoomMember[];
  onlineUserIds: Set<string>;
  userActivity: Map<string, ActivityStatus>;

  setCurrentRoom: (room: Room | null) => void;
  setMembers: (members: RoomMember[]) => void;
  setUserOnline: (userId: string, status: 'online' | 'offline') => void;
  setUserActivity: (userId: string, status: ActivityStatus) => void;
  addMember: (member: RoomMember) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  currentRoom: null,
  members: [],
  onlineUserIds: new Set(),
  userActivity: new Map(),

  setCurrentRoom: (room) => set({ currentRoom: room }),

  setMembers: (members) => set({ members }),

  setUserOnline: (userId, status) =>
    set((state) => {
      const next = new Set(state.onlineUserIds);
      if (status === 'online') next.add(userId);
      else next.delete(userId);
      return { onlineUserIds: next };
    }),

  setUserActivity: (userId, status) =>
    set((state) => {
      const next = new Map(state.userActivity);
      next.set(userId, status);
      return { userActivity: next };
    }),

  addMember: (member) =>
    set((state) => {
      const exists = state.members.some((m) => m.userId === member.userId);
      return exists ? state : { members: [...state.members, member] };
    }),

  reset: () => set({ currentRoom: null, members: [], onlineUserIds: new Set(), userActivity: new Map() }),
}));
