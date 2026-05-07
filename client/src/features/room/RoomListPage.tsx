import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { roomService } from './roomService';
import { authService } from '../auth/authService';
import { useAuthStore } from '../../store/authStore';
import { Room } from '../../types/room.types';
import { Avatar } from '../../components/ui/Avatar';
import { Spinner } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { disconnectSocket } from '../../config/socket';
import { formatDistanceToNow } from 'date-fns';

const LANGUAGE_ICONS: Record<string, string> = {
  javascript: '🟨',
  typescript: '🔷',
  python: '🐍',
  rust: '🦀',
  go: '🐹',
  java: '☕',
  default: '📄',
};

export const RoomListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshToken } = useAuthStore();
  const logout = useAuthStore((s) => s.logout);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    language: 'javascript',
    isPublic: true,
  });
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    loadRooms();
  }, []);

  async function loadRooms() {
    try {
      const data = await roomService.getRooms();
      setRooms(data);
    } catch {
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.name.trim()) { toast.error('Room name is required'); return; }

    setCreateLoading(true);
    try {
      const room = await roomService.createRoom(createForm);
      toast.success('Room created!');
      setShowCreate(false);
      navigate(`/room/${room.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create room';
      toast.error(msg);
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteInput.trim()) return;

    setJoinLoading(true);
    try {
      const room = await roomService.joinByInvite(inviteInput.trim());
      toast.success(`Joined "${room.name}"!`);
      setShowJoin(false);
      navigate(`/room/${room.id}`);
    } catch {
      toast.error('Invalid invite code');
    } finally {
      setJoinLoading(false);
    }
  }

  async function handleLogout() {
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch { /* ignore */ }
    disconnectSocket();
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-editor-border bg-surface-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <span className="text-white font-semibold text-lg">CodeSync</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            id="join-room-btn"
            onClick={() => setShowJoin(true)}
            className="btn-ghost text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
            </svg>
            Join via code
          </button>
          <button
            id="create-room-btn"
            onClick={() => setShowCreate(true)}
            className="btn-primary"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Room
          </button>

          <div className="flex items-center gap-2 ml-2 cursor-pointer group" onClick={handleLogout}>
            <Avatar username={user?.username ?? ''} color={user?.avatarColor} size="sm" />
            <span className="text-sm text-[#ccc] group-hover:text-white transition-colors">{user?.username}</span>
            <svg className="w-4 h-4 text-[#666] group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Your Rooms</h2>
          <p className="text-[#888] mt-1">Pick up where you left off, or start something new.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-surface-800 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No rooms yet</h3>
            <p className="text-[#888] mb-6">Create your first room to start coding together.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              Create a Room
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <div
                key={room.id}
                id={`room-card-${room.id}`}
                onClick={() => navigate(`/room/${room.id}`)}
                className="group bg-surface-800 border border-editor-border rounded-xl p-5
                           hover:border-brand-500/50 hover:bg-surface-700/50 cursor-pointer
                           transition-all duration-200 hover:shadow-lg hover:shadow-brand-500/10"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-2xl">
                    {LANGUAGE_ICONS[room.language] ?? LANGUAGE_ICONS.default}
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-white/5 text-[#888] rounded-full border border-white/10">
                    {room.language}
                  </span>
                </div>

                <h3 className="font-semibold text-white group-hover:text-brand-300 transition-colors mb-1">
                  {room.name}
                </h3>

                {room.description && (
                  <p className="text-xs text-[#888] mb-3 line-clamp-2">{room.description}</p>
                )}

                <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
                  <span className="text-xs text-[#666]">
                    {formatDistanceToNow(new Date(room.updated_at), { addSuffix: true })}
                  </span>
                  <span className="text-xs text-[#666]">
                    {room.is_public ? '🌐 Public' : '🔒 Private'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Room Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Room">
        <form onSubmit={handleCreateRoom} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#ccc] mb-1.5">Room Name *</label>
            <input
              id="create-room-name"
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="input-field"
              placeholder="My Awesome Project"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#ccc] mb-1.5">Description</label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="input-field resize-none h-20"
              placeholder="What are you building?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#ccc] mb-1.5">Language</label>
            <select
              value={createForm.language}
              onChange={(e) => setCreateForm({ ...createForm, language: e.target.value })}
              className="input-field"
            >
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="rust">Rust</option>
              <option value="go">Go</option>
              <option value="java">Java</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="room-public"
              checked={createForm.isPublic}
              onChange={(e) => setCreateForm({ ...createForm, isPublic: e.target.checked })}
              className="w-4 h-4 accent-brand-500"
            />
            <label htmlFor="room-public" className="text-sm text-[#ccc]">
              Public room (joinable by anyone with invite code)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">
              Cancel
            </button>
            <button id="create-room-submit" type="submit" disabled={createLoading} className="btn-primary">
              {createLoading ? <Spinner size="sm" /> : 'Create Room'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Join Room Modal */}
      <Modal isOpen={showJoin} onClose={() => setShowJoin(false)} title="Join a Room">
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#ccc] mb-1.5">Invite Code</label>
            <input
              id="join-invite-code"
              type="text"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              className="input-field font-mono tracking-widest"
              placeholder="XXXXXXXXXXXX"
              maxLength={12}
              autoFocus
            />
            <p className="text-xs text-[#666] mt-1">Ask the room owner for the 12-character invite code.</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowJoin(false)} className="btn-ghost">
              Cancel
            </button>
            <button id="join-room-submit" type="submit" disabled={joinLoading} className="btn-primary">
              {joinLoading ? <Spinner size="sm" /> : 'Join Room'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
