import React, { useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { EditorFile, getLanguageFromFilename } from '../../types/file.types';
import { fileService } from './fileService';
import { getSocket } from '../../config/socket';
import { FsFileCreatedPayload, FsFileRenamedPayload, FsFileDeletedPayload } from '../../types/socket.types';
import toast from 'react-hot-toast';

interface FileExplorerProps {
  roomId: string;
  files: EditorFile[];
  onFilesChange: (files: EditorFile[]) => void;
}

// ── Tree building ─────────────────────────────────────────────────────────────
interface TreeNode {
  type: 'file' | 'dir';
  name: string;
  path: string;           // full path (for dirs = virtual prefix)
  file?: EditorFile;      // only for type='file'
  children?: TreeNode[];  // only for type='dir'
}

function buildTree(files: EditorFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();

  // Sort: directories (by path depth) first, then files alphabetically
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    // strip leading slash, split into parts
    const parts = file.path.replace(/^\//, '').split('/');
    const fileName = parts[parts.length - 1];
    const dirParts = parts.slice(0, -1);

    let siblings = root;

    // Ensure each directory segment exists
    for (let d = 0; d < dirParts.length; d++) {
      const segment = dirParts[d];
      const dirPath = '/' + dirParts.slice(0, d + 1).join('/');

      let dirNode = dirMap.get(dirPath);
      if (!dirNode) {
        dirNode = { type: 'dir', name: segment, path: dirPath, children: [] };
        dirMap.set(dirPath, dirNode);
        siblings.push(dirNode);
      }
      siblings = dirNode.children!;
    }

    siblings.push({ type: 'file', name: fileName, path: file.path, file });
  }

  return root;
}

// ── File icons ────────────────────────────────────────────────────────────────
const EXT_ICONS: Record<string, string> = {
  js: '🟨', jsx: '🟨', ts: '🔷', tsx: '🔷', py: '🐍',
  rs: '🦀', go: '🐹', java: '☕', html: '🌐', css: '🎨',
  scss: '🎨', json: '📋', md: '📝', yaml: '⚙️', yml: '⚙️',
  sh: '💻', sql: '🗃️', xml: '📄',
};
function fileIcon(name: string) {
  return EXT_ICONS[name.split('.').pop()?.toLowerCase() ?? ''] ?? '📄';
}

// ── Context menu type ─────────────────────────────────────────────────────────
interface CtxMenu {
  x: number; y: number;
  type: 'file' | 'dir';
  node: TreeNode;
}

// ── Main component ────────────────────────────────────────────────────────────
export const FileExplorer: React.FC<FileExplorerProps> = ({ roomId, files, onFilesChange }) => {
  const { openFile, addFile, activeFileId, removeFile } = useEditorStore();
  const socket = getSocket();

  // UI state
  const [collapsedDirs, setCollapsedDirs] = useState(new Set<string>());
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [creating, setCreating] = useState<{ parentPath: string } | null>(null);
  const [creatingDir, setCreatingDir] = useState<{ parentPath: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const tree = buildTree(files);

  // ── Real-time FS sync ─────────────────────────────────────────────────────
  useEffect(() => {
    const onCreated = ({ file }: FsFileCreatedPayload) => {
      onFilesChange([...files, file as EditorFile]);
      addFile(file as EditorFile);
      toast(`📄 ${file.name} created`, { duration: 2000 });
    };
    const onRenamed = ({ fileId, name, path }: FsFileRenamedPayload) => {
      onFilesChange(files.map((f) => f.id === fileId ? { ...f, name, path } : f));
    };
    const onDeleted = ({ fileId }: FsFileDeletedPayload) => {
      removeFile(fileId);
      onFilesChange(files.filter((f) => f.id !== fileId));
    };

    socket.on('fs:remote-file-created', onCreated);
    socket.on('fs:remote-file-renamed', onRenamed);
    socket.on('fs:remote-file-deleted', onDeleted);
    return () => {
      socket.off('fs:remote-file-created', onCreated);
      socket.off('fs:remote-file-renamed', onRenamed);
      socket.off('fs:remote-file-deleted', onDeleted);
    };
  }, [socket, files, onFilesChange, addFile, removeFile]);

  // Close context menu on outside click
  useEffect(() => {
    const close = () => setCtxMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // ── File creation ─────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent, parentPath: string) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) { setCreating(null); setNewName(''); return; }

    const path = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
    try {
      const file = await fileService.createFile(roomId, { name, path, language: getLanguageFromFilename(name) });
      onFilesChange([...files, file]);
      addFile(file);
      openFile(file);
      socket.emit('fs:file-created', { roomId, file });
      toast.success(`Created ${name}`);
    } catch { toast.error('Failed to create file'); }
    finally { setCreating(null); setNewName(''); }
  }

  // ── Folder creation (creates a .gitkeep placeholder) ──────────────────────
  async function handleCreateDir(e: React.FormEvent, parentPath: string) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) { setCreatingDir(null); setNewName(''); return; }

    const folderPath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
    const keepPath  = `${folderPath}/.gitkeep`;
    try {
      const file = await fileService.createFile(roomId, { name: '.gitkeep', path: keepPath, language: 'plaintext' });
      onFilesChange([...files, file]);
      addFile(file);
      socket.emit('fs:file-created', { roomId, file });
      toast.success(`Created folder ${name}`);
    } catch { toast.error('Failed to create folder'); }
    finally { setCreatingDir(null); setNewName(''); }
  }

  // ── Rename ────────────────────────────────────────────────────────────────
  async function handleRename(fileId: string) {
    const file = files.find((f) => f.id === fileId);
    if (!file || !renameVal.trim() || renameVal === file.name) { setRenamingId(null); return; }
    const newPath = file.path.replace(/[^/]+$/, renameVal.trim());
    try {
      const updated = await fileService.renameFile(roomId, fileId, renameVal.trim(), newPath);
      onFilesChange(files.map((f) => f.id === fileId ? updated : f));
      socket.emit('fs:file-renamed', { roomId, fileId, name: updated.name, path: updated.path });
      toast.success(`Renamed to ${renameVal}`);
    } catch { toast.error('Failed to rename'); }
    finally { setRenamingId(null); }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(fileId: string, fileName: string) {
    if (!confirm(`Delete "${fileName}"?`)) return;
    try {
      await fileService.deleteFile(roomId, fileId);
      removeFile(fileId);
      onFilesChange(files.filter((f) => f.id !== fileId));
      socket.emit('fs:file-deleted', { roomId, fileId });
      toast.success(`Deleted ${fileName}`);
    } catch { toast.error('Failed to delete'); }
    setCtxMenu(null);
  }

  // ── Recursive tree renderer ───────────────────────────────────────────────
  const renderNodes = useCallback((nodes: TreeNode[], depth = 0) => {
    const indent = depth * 12;

    return nodes.map((node) => {
      if (node.type === 'dir') {
        const collapsed = collapsedDirs.has(node.path);
        return (
          <div key={node.path}>
            {/* Directory row */}
            <div
              className="flex items-center gap-1 px-2 py-[3px] rounded cursor-pointer
                         hover:bg-white/5 text-[#ccc] select-none group"
              style={{ paddingLeft: 8 + indent }}
              onClick={() => setCollapsedDirs((s) => {
                const n = new Set(s);
                collapsed ? n.delete(node.path) : n.add(node.path);
                return n;
              })}
              onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'dir', node }); }}
            >
              {/* Chevron */}
              <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {/* Folder icon */}
              <svg className="w-3.5 h-3.5 flex-shrink-0 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                {collapsed
                  ? <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                  : <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v1H2V6zm0 3h16v5a2 2 0 01-2 2H4a2 2 0 01-2-2V9z" clipRule="evenodd"/>
                }
              </svg>
              <span className="flex-1 text-xs truncate">{node.name}</span>
              {/* Hover actions */}
              <div className="hidden group-hover:flex items-center gap-1">
                <button title="New File" className="text-[#666] hover:text-white p-0.5"
                  onClick={(e) => { e.stopPropagation(); setCreating({ parentPath: node.path }); setNewName(''); }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                <button title="New Folder" className="text-[#666] hover:text-white p-0.5"
                  onClick={(e) => { e.stopPropagation(); setCreatingDir({ parentPath: node.path }); setNewName(''); }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Children */}
            {!collapsed && (
              <div>
                {/* Inline create input inside this dir */}
                {creating?.parentPath === node.path && (
                  <form onSubmit={(e) => handleCreate(e, node.path)} className="px-2 py-0.5" style={{ paddingLeft: 8 + indent + 16 }}>
                    <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                      onBlur={() => { setCreating(null); setNewName(''); }}
                      className="w-full bg-surface-900 border border-brand-500 text-[#d4d4d4] text-xs rounded px-1.5 py-0.5 outline-none"
                      placeholder="filename.ts" />
                  </form>
                )}
                {creatingDir?.parentPath === node.path && (
                  <form onSubmit={(e) => handleCreateDir(e, node.path)} className="px-2 py-0.5" style={{ paddingLeft: 8 + indent + 16 }}>
                    <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                      onBlur={() => { setCreatingDir(null); setNewName(''); }}
                      className="w-full bg-surface-900 border border-yellow-500 text-[#d4d4d4] text-xs rounded px-1.5 py-0.5 outline-none"
                      placeholder="folder-name" />
                  </form>
                )}
                {renderNodes(node.children ?? [], depth + 1)}
              </div>
            )}
          </div>
        );
      }

      // File node
      const file = node.file!;
      // Hide .gitkeep placeholder files
      if (file.name === '.gitkeep') return null;

      return (
        <div
          key={file.id}
          id={`file-item-${file.id}`}
          className={`flex items-center gap-1.5 px-2 py-[3px] rounded cursor-pointer
                      hover:bg-white/5 group text-[#ccc]
                      ${activeFileId === file.id ? 'bg-white/10 text-white' : ''}`}
          style={{ paddingLeft: 8 + indent }}
          onClick={() => openFile(file)}
          onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'file', node }); }}
        >
          <span className="text-[11px] flex-shrink-0">{fileIcon(file.name)}</span>

          {renamingId === file.id ? (
            <input autoFocus value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onBlur={() => handleRename(file.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(file.id); if (e.key === 'Escape') setRenamingId(null); }}
              className="flex-1 bg-transparent border-b border-brand-500 text-xs outline-none text-[#d4d4d4]"
              onClick={(e) => e.stopPropagation()} />
          ) : (
            <span className="flex-1 truncate text-xs">{file.name}</span>
          )}
        </div>
      );
    });
  }, [collapsedDirs, activeFileId, renamingId, renameVal, creating, creatingDir, newName, files]);

  return (
    <div className="flex flex-col h-full select-none">
      {/* Header */}
      <div className="panel-header">
        <span>Explorer</span>
        <div className="flex items-center gap-1">
          <button id="new-file-btn" title="New File"
            className="text-[#888] hover:text-white transition-colors p-0.5"
            onClick={() => { setCreating({ parentPath: '/' }); setNewName(''); }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button id="new-folder-btn" title="New Folder"
            className="text-[#888] hover:text-white transition-colors p-0.5"
            onClick={() => { setCreatingDir({ parentPath: '/' }); setNewName(''); }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1 px-1 text-sm">
        {/* Root-level create input */}
        {creating?.parentPath === '/' && (
          <form onSubmit={(e) => handleCreate(e, '/')} className="px-2 py-1">
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onBlur={() => { setCreating(null); setNewName(''); }}
              className="w-full bg-surface-900 border border-brand-500 text-[#d4d4d4] text-xs rounded px-2 py-1 outline-none"
              placeholder="filename.ts" />
          </form>
        )}
        {creatingDir?.parentPath === '/' && (
          <form onSubmit={(e) => handleCreateDir(e, '/')} className="px-2 py-1">
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onBlur={() => { setCreatingDir(null); setNewName(''); }}
              className="w-full bg-surface-900 border border-yellow-500 text-[#d4d4d4] text-xs rounded px-2 py-1 outline-none"
              placeholder="folder-name" />
          </form>
        )}

        {renderNodes(tree)}

        {files.length === 0 && !creating && !creatingDir && (
          <div className="px-3 py-4 text-xs text-[#666] text-center">
            No files yet.<br />
            <button className="text-brand-400 hover:text-brand-300 mt-1"
              onClick={() => { setCreating({ parentPath: '/' }); setNewName(''); }}>
              Create one
            </button>
          </div>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div style={{ top: ctxMenu.y, left: ctxMenu.x }}
          className="fixed z-50 bg-surface-800 border border-editor-border rounded-lg py-1
                     shadow-xl animate-fade-in min-w-[160px]"
          onClick={(e) => e.stopPropagation()}>
          {ctxMenu.type === 'dir' && (
            <>
              <button className="w-full text-left px-3 py-1.5 text-xs text-[#ccc] hover:bg-white/10"
                onClick={() => { setCreating({ parentPath: ctxMenu.node.path }); setNewName(''); setCtxMenu(null); }}>
                📄 New File Here
              </button>
              <button className="w-full text-left px-3 py-1.5 text-xs text-[#ccc] hover:bg-white/10"
                onClick={() => { setCreatingDir({ parentPath: ctxMenu.node.path }); setNewName(''); setCtxMenu(null); }}>
                📁 New Subfolder
              </button>
            </>
          )}
          {ctxMenu.type === 'file' && ctxMenu.node.file && (
            <>
              <button className="w-full text-left px-3 py-1.5 text-xs text-[#ccc] hover:bg-white/10"
                onClick={() => {
                  setRenamingId(ctxMenu.node.file!.id);
                  setRenameVal(ctxMenu.node.file!.name);
                  setCtxMenu(null);
                }}>
                ✏️ Rename
              </button>
              <button className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                onClick={() => handleDelete(ctxMenu.node.file!.id, ctxMenu.node.file!.name)}>
                🗑️ Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
