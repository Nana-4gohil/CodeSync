import React from 'react';
import { useEditorStore } from '../../store/editorStore';
import { EditorFile } from '../../types/file.types';

interface EditorTabsProps {
  files: EditorFile[];
}

const FILE_ICONS: Record<string, string> = {
  javascript: '🟨',
  typescript: '🔷',
  python: '🐍',
  rust: '🦀',
  go: '🐹',
  html: '🌐',
  css: '🎨',
  json: '📋',
  markdown: '📝',
  default: '📄',
};


export const EditorTabs: React.FC<EditorTabsProps> = ({ files }) => {
  const { openFileIds, activeFileId, isDirty, setActiveFile, closeFile } = useEditorStore();

  const openFiles = openFileIds
    .map((id) => files.find((f) => f.id === id))
    .filter(Boolean) as EditorFile[];

  if (openFiles.length === 0) return null;

  return (
    <div className="flex items-center bg-editor-tab border-b border-editor-border overflow-x-auto flex-shrink-0 h-10">
      {openFiles.map((file) => {
        const isActive = file.id === activeFileId;
        const dirty = isDirty[file.id];
        const icon = FILE_ICONS[file.language] ?? FILE_ICONS.default;

        return (
          <div
            key={file.id}
            id={`tab-${file.id}`}
            className={`tab-item ${isActive ? 'active' : ''}`}
            onClick={() => setActiveFile(file.id)}
            title={file.path}
          >
            <span className="text-xs">{icon}</span>
            <span className="text-xs max-w-[120px] truncate">{file.name}</span>

            {/* Dirty indicator */}
            {dirty && (
              <span className="w-2 h-2 rounded-full bg-[#c0c0c0] flex-shrink-0" title="Unsaved changes" />
            )}

            {/* Close button */}
            <button
              className="ml-0.5 p-0.5 rounded hover:bg-white/20 text-[#666] hover:text-[#ccc]
                         transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
              style={{ opacity: isActive || dirty ? 1 : undefined }}
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.id);
              }}
              title="Close tab"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
};
