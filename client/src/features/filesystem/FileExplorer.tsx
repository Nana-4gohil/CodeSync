import React, { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { EditorFile, getLanguageFromFilename } from '../../types/file.types';
import { fileService } from './fileService';
import toast from 'react-hot-toast';

interface FileExplorerProps {
  roomId: string;
  files: EditorFile[];
  onFilesChange: (files: EditorFile[]) => void;
}

const FILE_EXT_ICONS: Record<string, string> = {
  js: '🟨', jsx: '🟨', ts: '🔷', tsx: '🔷',
  py: '🐍', rs: '🦀', go: '🐹', java: '☕',
  html: '🌐', css: '🎨', scss: '🎨', json: '📋',
  md: '📝', yaml: '⚙️', yml: '⚙️', sh: '💻',
  sql: '🗃️', xml: '📄',
};

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return FILE_EXT_ICONS[ext] ?? '📄';
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ roomId, files, onFilesChange }) => {
  const { openFile, activeFileId, removeFile } = useEditorStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fileId: string } | null>(null);

  async function handleCreateFile(e: React.FormEvent) {
    e.preventDefault();
    if (!newFileName.trim()) return;

    const name = newFileName.trim();
    const path = `/${name}`;
    const language = getLanguageFromFilename(name);

    try {
      const file = await fileService.createFile(roomId, { name, path, language });
      onFilesChange([...files, file]);
      openFile(file);
      toast.success(`Created ${name}`);
    } catch {
      toast.error('Failed to create file');
    } finally {
      setIsCreating(false);
      setNewFileName('');
    }
  }

  async function handleRename(fileId: string) {
    const file = files.find((f) => f.id === fileId);
    if (!file || !renameValue.trim() || renameValue === file.name) {
      setRenamingId(null);
      return;
    }

    try {
      const updated = await fileService.renameFile(
        roomId,
        fileId,
        renameValue.trim(),
        `/${renameValue.trim()}`,
      );
      onFilesChange(files.map((f) => (f.id === fileId ? updated : f)));
      toast.success(`Renamed to ${renameValue}`);
    } catch {
      toast.error('Failed to rename file');
    } finally {
      setRenamingId(null);
    }
  }

  async function handleDelete(fileId: string) {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;

    if (!confirm(`Delete "${file.name}"?`)) return;

    try {
      await fileService.deleteFile(roomId, fileId);
      removeFile(fileId);
      onFilesChange(files.filter((f) => f.id !== fileId));
      toast.success(`Deleted ${file.name}`);
    } catch {
      toast.error('Failed to delete file');
    }
    setContextMenu(null);
  }

  function handleContextMenu(e: React.MouseEvent, fileId: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, fileId });
  }

  // Close context menu on click away
  React.useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <div className="flex flex-col h-full select-none">
      {/* Header */}
      <div className="panel-header">
        <span>Explorer</span>
        <button
          id="new-file-btn"
          className="text-[#888] hover:text-white transition-colors"
          onClick={() => setIsCreating(true)}
          title="New File"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {/* New file input */}
        {isCreating && (
          <form onSubmit={handleCreateFile} className="px-2 py-1">
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onBlur={() => { setIsCreating(false); setNewFileName(''); }}
              className="w-full bg-surface-900 border border-brand-500 text-[#d4d4d4] text-xs
                         rounded px-2 py-1 outline-none"
              placeholder="filename.js"
              autoFocus
            />
          </form>
        )}

        {files.map((file) => (
          <div
            key={file.id}
            id={`file-item-${file.id}`}
            className={`file-tree-item group ${activeFileId === file.id ? 'active' : ''}`}
            onClick={() => openFile(file)}
            onContextMenu={(e) => handleContextMenu(e, file.id)}
          >
            <span className="text-xs">{getFileIcon(file.name)}</span>

            {renamingId === file.id ? (
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleRename(file.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(file.id);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="flex-1 bg-transparent border-b border-brand-500 text-xs outline-none text-[#d4d4d4]"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="flex-1 truncate text-xs">{file.name}</span>
            )}
          </div>
        ))}

        {files.length === 0 && !isCreating && (
          <div className="px-3 py-4 text-xs text-[#666] text-center">
            No files yet.
            <br />
            <button
              className="text-brand-400 hover:text-brand-300 mt-1"
              onClick={() => setIsCreating(true)}
            >
              Create one
            </button>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-surface-800 border border-editor-border rounded-lg py-1
                     shadow-xl animate-fade-in min-w-[140px]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-[#ccc] hover:bg-white/10 transition-colors"
            onClick={() => {
              const file = files.find((f) => f.id === contextMenu.fileId);
              if (file) { setRenamingId(file.id); setRenameValue(file.name); }
              setContextMenu(null);
            }}
          >
            ✏️ Rename
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            onClick={() => handleDelete(contextMenu.fileId)}
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
};
