import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { roomService } from './roomService';
import { fileService } from '../filesystem/fileService';
import { useEditorStore } from '../../store/editorStore';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../config/socket';
import { EditorFile } from '../../types/file.types';
import { RoomMember } from '../../types/room.types';
import { CodeEditor } from '../editor/CodeEditor';
import { EditorTabs } from '../editor/EditorTabs';
import { FileExplorer } from '../filesystem/FileExplorer';
import { ChatPanel } from '../chat/ChatPanel';
import { TerminalPanel } from '../execution/TerminalPanel';
import { ResizablePanel } from '../../components/ui/ResizablePanel';
import { Avatar } from '../../components/ui/Avatar';
import { Spinner } from '../../components/ui/Spinner';
import { RoomMemberPayload } from '../../types/socket.types';
import { PresenceBar } from './PresenceBar';

type SidebarPanel = 'explorer' | 'chat' | 'members';
type BottomPanel = 'terminal' | 'none';

export const RoomPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const socket = getSocket();

  const { currentRoom, setCurrentRoom, setMembers, setUserOnline, onlineUserIds, members } = useRoomStore();
  const { files, activeFileId, setFiles, reset: resetEditor } = useEditorStore();
  const [localFiles, setLocalFiles] = useState<EditorFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>('explorer');
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>('terminal');
  const [showInvite, setShowInvite] = useState(false);

  const activeFile = files.find((f) => f.id === activeFileId) ?? null;

  // ── Load room + files ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;

    (async () => {
      try {
        const [room, roomFiles] = await Promise.all([
          roomService.getRoom(roomId),
          fileService.getFiles(roomId),
        ]);

        setCurrentRoom(room);
        setFiles(roomFiles);
        setLocalFiles(roomFiles);

        // Auto-open first file
        if (roomFiles.length > 0) {
          useEditorStore.getState().openFile(roomFiles[0]);
        }

        // Join the socket room after data is loaded.
        // Doing it here (not in a separate effect) prevents the loading-state
        // re-render from triggering room:leave via the other effect's cleanup.
        socket.emit('room:join', { roomId });
      } catch {
        toast.error('Failed to load room');
        navigate('/');
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      setCurrentRoom(null);
      resetEditor();
    };
  }, [roomId]);

  // ── Socket room events ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;


    const onMembers = ({ members }: { members: RoomMemberPayload[] }) => {
      setMembers(members as RoomMember[]);
    };

    const onUserJoined = ({ user: joiningUser, members }: { user: RoomMemberPayload; members: RoomMemberPayload[] }) => {
      setMembers(members as RoomMember[]);
      setUserOnline(joiningUser.userId, 'online');
      toast(`${joiningUser.username} joined the room`, { icon: '👋', duration: 3000 });
    };

    const onPresence = ({ userId, status }: { userId: string; status: 'online' | 'offline' }) => {
      setUserOnline(userId, status);
    };

    socket.on('room:members', onMembers);
    socket.on('room:user-joined', onUserJoined);
    socket.on('room:presence', onPresence);

    return () => {
      socket.emit('room:leave', { roomId });
      socket.off('room:members', onMembers);
      socket.off('room:user-joined', onUserJoined);
      socket.off('room:presence', onPresence);
    };
  }, [roomId]); // NOT [roomId,loading] - loading change must not fire cleanup (room:leave)

  // ── Files state sync ───────────────────────────────────────────────────────
  useEffect(() => {
    setFiles(localFiles);
  }, [localFiles]);

  if (loading) {
    return (
      <div className="h-screen bg-editor-bg flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="text-brand-500 mx-auto mb-3" />
          <p className="text-[#888] text-sm">Loading room…</p>
        </div>
      </div>
    );
  }

  const inviteUrl = `${window.location.origin}/invite/${currentRoom?.inviteCode}`;

  return (
    <div className="h-screen flex flex-col bg-editor-bg overflow-hidden">
      {/* ── Title Bar ───────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-3 py-1.5 bg-editor-titlebar border-b border-editor-border flex-shrink-0 h-10">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-1.5 text-[#ccc] hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="w-px h-4 bg-editor-border" />
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-brand-600 rounded flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <span className="text-sm text-white font-medium">{currentRoom?.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Google Docs-style presence — colored avatar per online user, 💤 when idle */}
          <PresenceBar roomId={roomId!} />

          {/* Invite button */}
          <button
            id="invite-btn"
            onClick={() => setShowInvite(!showInvite)}
            className="btn-ghost text-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Invite
          </button>

          {showInvite && (
            <div className="absolute top-12 right-4 z-50 bg-surface-800 border border-editor-border rounded-xl p-4 shadow-2xl w-80 animate-slide-up">
              <p className="text-xs font-semibold text-[#ccc] mb-2">Invite Link</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="flex-1 bg-surface-900 border border-editor-border text-xs text-[#d4d4d4] px-2 py-1.5 rounded outline-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl);
                    toast.success('Copied!');
                    setShowInvite(false);
                  }}
                  className="btn-primary text-xs px-3"
                >
                  Copy
                </button>
              </div>
              <p className="text-[10px] text-[#555] mt-2">Code: <span className="font-mono text-[#888]">{currentRoom?.inviteCode}</span></p>
            </div>
          )}

          <Avatar username={user?.username ?? ''} color={user?.avatarColor} size="xs" />
        </div>
      </header>

      {/* ── Main Layout ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Activity Bar */}
        <div className="w-12 bg-editor-activitybar flex flex-col items-center py-2 gap-1 flex-shrink-0 border-r border-editor-border">
          {[
            {
              id: 'explorer' as SidebarPanel,
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              ),
              label: 'Explorer',
            },
            {
              id: 'chat' as SidebarPanel,
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              ),
              label: 'Chat',
            },
            {
              id: 'members' as SidebarPanel,
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ),
              label: 'Members',
            },
          ].map(({ id, icon, label }) => (
            <button
              key={id}
              id={`activity-${id}`}
              className={`sidebar-icon ${sidebarPanel === id ? 'active' : ''}`}
              onClick={() => setSidebarPanel(id)}
              title={label}
            >
              {icon}
            </button>
          ))}

          <div className="flex-1" />

          {/* Bottom panel toggle */}
          <button
            id="activity-terminal"
            className={`sidebar-icon ${bottomPanel === 'terminal' ? 'active' : ''}`}
            onClick={() => setBottomPanel((p) => (p === 'terminal' ? 'none' : 'terminal'))}
            title="Terminal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        </div>

        {/* Sidebar content */}
        <div className="w-60 bg-editor-sidebar border-r border-editor-border flex-shrink-0 flex flex-col overflow-hidden">
          {sidebarPanel === 'explorer' && (
            <FileExplorer
              roomId={roomId!}
              files={localFiles}
              onFilesChange={setLocalFiles}
            />
          )}

          {sidebarPanel === 'chat' && <ChatPanel roomId={roomId!} />}

          {sidebarPanel === 'members' && (
            <div className="flex flex-col h-full">
              <div className="panel-header">
                <span>Members ({members.length})</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {members.map((m) => (
                  <div key={m.userId} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5">
                    <Avatar username={m.username} color={m.avatarColor} size="sm" online={onlineUserIds.has(m.userId)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#d4d4d4] truncate">{m.username}</p>
                      <p className="text-xs text-[#666] capitalize">{m.role}</p>
                    </div>
                    <span className={`status-dot ${onlineUserIds.has(m.userId) ? 'online' : 'offline'}`} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Editor + Terminal area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Tabs */}
          <EditorTabs files={localFiles} />

          {/* Editor + optional terminal */}
          {bottomPanel === 'terminal' ? (
            <ResizablePanel
              direction="vertical"
              defaultSize={65}
              minSize={30}
              maxSize={85}
              className="flex-1 min-h-0"
            >
              <EditorArea activeFile={activeFile} roomId={roomId!} />
              <TerminalPanel
                roomId={roomId!}
                fileId={activeFile?.id ?? ''}
                code={activeFile?.content ?? ''}
                language={activeFile?.language ?? 'javascript'}
              />
            </ResizablePanel>
          ) : (
            <div className="flex-1 min-h-0">
              <EditorArea activeFile={activeFile} roomId={roomId!} />
            </div>
          )}
        </div>
      </div>

      {/* ── Status Bar ───────────────────────────────────────────────────────── */}
      <footer className="flex items-center justify-between px-4 h-6 bg-brand-600 text-xs text-white/80 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span>⚡ CodeSync</span>
          {currentRoom && <span>{currentRoom.language}</span>}
        </div>
        <div className="flex items-center gap-3">
          {activeFile && <span>{activeFile.name}</span>}
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block" />
            {onlineUserIds.size} online
          </span>
        </div>
      </footer>
    </div>
  );
};

/** Inner component so it doesn't re-render the whole page when file changes */
const EditorArea: React.FC<{ activeFile: EditorFile | null; roomId: string }> = ({ activeFile, roomId }) => {
  if (!activeFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-editor-bg text-center">
        <div className="w-16 h-16 bg-surface-800 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <p className="text-[#555] text-sm">Select a file to start editing</p>
      </div>
    );
  }

  return (
    <CodeEditor
      roomId={roomId}
      fileId={activeFile.id}
      content={activeFile.content}
      language={activeFile.language}
    />
  );
};
