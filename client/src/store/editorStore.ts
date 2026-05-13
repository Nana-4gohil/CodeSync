import { create } from 'zustand';
import { EditorFile } from '../types/file.types';

interface EditorStore {
  files: EditorFile[];
  openFileIds: string[];
  activeFileId: string | null;
  isDirty: Record<string, boolean>; // fileId → has unsaved changes

  setFiles: (files: EditorFile[]) => void;
  openFile: (file: EditorFile) => void;
  closeFile: (fileId: string) => void;
  setActiveFile: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;  // local edits → marks dirty
  applyRemoteContent: (fileId: string, content: string) => void; // remote edits → no dirty
  markClean: (fileId: string) => void;
  addFile: (file: EditorFile) => void;
  removeFile: (fileId: string) => void;
  reset: () => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  files: [],
  openFileIds: [],
  activeFileId: null,
  isDirty: {},

  setFiles: (files) => set({ files }),

  openFile: (file) => {
    const { openFileIds } = get();
    if (!openFileIds.includes(file.id)) {
      set({ openFileIds: [...openFileIds, file.id], activeFileId: file.id });
    } else {
      set({ activeFileId: file.id });
    }
    // Ensure file is in the files list
    set((state) => ({
      files: state.files.find((f) => f.id === file.id)
        ? state.files
        : [...state.files, file],
    }));
  },

  closeFile: (fileId) => {
    const { openFileIds, activeFileId } = get();
    const newOpenIds = openFileIds.filter((id) => id !== fileId);
    const newActive =
      activeFileId === fileId
        ? newOpenIds[newOpenIds.length - 1] ?? null
        : activeFileId;

    set((state) => ({
      openFileIds: newOpenIds,
      activeFileId: newActive,
      isDirty: Object.fromEntries(
        Object.entries(state.isDirty).filter(([id]) => id !== fileId),
      ),
    }));
  },

  setActiveFile: (fileId) => set({ activeFileId: fileId }),

  updateFileContent: (fileId, content) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId ? { ...f, content } : f,
      ),
      isDirty: { ...state.isDirty, [fileId]: true }, // local edit → mark dirty
    }));
  },

  // Remote changes: update content WITHOUT touching isDirty
  applyRemoteContent: (fileId, content) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId ? { ...f, content } : f,
      ),
      // isDirty intentionally NOT changed
    }));
  },

  markClean: (fileId) => {
    set((state) => ({
      isDirty: { ...state.isDirty, [fileId]: false },
    }));
  },

  addFile: (file) => {
    set((state) => ({
      files: [...state.files, file],
    }));
  },

  removeFile: (fileId) => {
    const { openFileIds } = get();
    if (openFileIds.includes(fileId)) {
      get().closeFile(fileId);
    }
    set((state) => ({
      files: state.files.filter((f) => f.id !== fileId),
    }));
  },

  reset: () => set({ files: [], openFileIds: [], activeFileId: null, isDirty: {} }),
}));
