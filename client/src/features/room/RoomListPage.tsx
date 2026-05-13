import React, { useEffect, useRef, useState } from 'react';
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
  javascript: '🟨', typescript: '🔷', python: '🐍',
  rust: '🦀', go: '🐹', java: '☕', cpp: '⚡',
  c: '⚙️', csharp: '💜', php: '🐘', ruby: '💎',
  html: '🌐', css: '🎨', sql: '🗃️', default: '📄',
};

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python',     label: 'Python'     },
  { value: 'rust',       label: 'Rust'       },
  { value: 'go',         label: 'Go'         },
  { value: 'java',       label: 'Java'       },
  { value: 'cpp',        label: 'C++'        },
  { value: 'c',          label: 'C'          },
  { value: 'csharp',     label: 'C#'         },
  { value: 'php',        label: 'PHP'        },
  { value: 'ruby',       label: 'Ruby'       },
  { value: 'html',       label: 'HTML'       },
  { value: 'css',        label: 'CSS'        },
  { value: 'sql',        label: 'SQL'        },
];

export const RoomListPage: React.FC = () => {
  const navigate  = useNavigate();
  const { user, refreshToken } = useAuthStore();
  const logout    = useAuthStore((s) => s.logout);

  const [rooms,        setRooms]        = useState<Room[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showCreate,   setShowCreate]   = useState(false);
  const [showJoin,     setShowJoin]     = useState(false);
  const [inviteInput,  setInviteInput]  = useState('');
  const [joinLoading,  setJoinLoading]  = useState(false);

  // ── Create form ────────────────────────────────────────────────────────────
  const [createForm,    setCreateForm]    = useState({ name: '', description: '', language: 'javascript', isPublic: true });
  const [createLoading, setCreateLoading] = useState(false);

  // ── Edit / Delete state ────────────────────────────────────────────────────
  const [editRoom,      setEditRoom]      = useState<Room | null>(null);
  const [editForm,      setEditForm]      = useState({ name: '', description: '', language: '', isPublic: true });
  const [editLoading,   setEditLoading]   = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null); // roomId being deleted
  const [cardMenu,      setCardMenu]      = useState<string | null>(null); // roomId whose menu is open
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Leave (for non-owners from list page) ─────────────────────────────────
  async function handleLeaveRoom(room: Room) {
    setCardMenu(null);
    if (!confirm(`Leave "${room.name}"? You can rejoin via the invite code.`)) return;
    try {
      await roomService.leaveRoom(room.id);
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
      toast.success(`Left "${room.name}"`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to leave room');
    }
  }

  useEffect(() => { loadRooms(); }, []);

  // Close card menu on outside click
  useEffect(() => {
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCardMenu(null);
      }
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
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

  // ── Create ─────────────────────────────────────────────────────────────────
  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.name.trim()) { toast.error('Room name is required'); return; }
    setCreateLoading(true);
    try {
      const room = await roomService.createRoom(createForm);
      toast.success('Room created!');
      setShowCreate(false);
      navigate(`/room/${room.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create room');
    } finally {
      setCreateLoading(false);
    }
  }

  // ── Join ───────────────────────────────────────────────────────────────────
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

  // ── Edit ───────────────────────────────────────────────────────────────────
  function openEdit(room: Room) {
    setEditRoom(room);
    setEditForm({ name: room.name, description: room.description ?? '', language: room.language, isPublic: room.isPublic });
    setCardMenu(null);
  }

  async function handleUpdateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!editRoom) return;
    if (!editForm.name.trim()) { toast.error('Room name is required'); return; }
    setEditLoading(true);
    try {
      const updated = await roomService.updateRoom(editRoom.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        language: editForm.language,
        isPublic: editForm.isPublic,
      });
      setRooms((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      toast.success('Room updated!');
      setEditRoom(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to update room');
    } finally {
      setEditLoading(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDeleteRoom(room: Room) {
    setCardMenu(null);
    if (!confirm(`Permanently delete "${room.name}"? This will also delete all files. This cannot be undone.`)) return;
    setDeleteLoading(room.id);
    try {
      await roomService.deleteRoom(room.id);
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
      toast.success(`"${room.name}" deleted`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to delete room');
    } finally {
      setDeleteLoading(null);
    }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async function handleLogout() {
    try { if (refreshToken) await authService.logout(refreshToken); } catch { /* ignore */ }
    disconnectSocket();
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
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
          <button id="join-room-btn" onClick={() => setShowJoin(true)} className="btn-ghost text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
            </svg>
            Join via code
          </button>
          <button id="create-room-btn" onClick={() => setShowCreate(true)} className="btn-primary">
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

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Your Rooms</h2>
          <p className="text-[#888] mt-1">Pick up where you left off, or start something new.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-surface-800 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No rooms yet</h3>
            <p className="text-[#888] mb-6">Create your first room to start coding together.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary">Create a Room</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => {
              // Primary: ownerId set by Room toJSON transform (after server restart).
              // Fallback: scan the embedded members array for role==='owner' matching user.id.
              // The members array is always present in the getRooms response.
              const myMember = (room as any).members?.find?.(
                (m: any) => String(m.user?._id ?? m.user) === String(user?.id)
              );
              const isOwner = room.ownerId === user?.id || myMember?.role === 'owner';
              const isDeleting = deleteLoading === room.id;
              const menuOpen   = cardMenu === room.id;

              return (
                <div
                  key={room.id}
                  id={`room-card-${room.id}`}
                  className="group relative bg-surface-800 border border-editor-border rounded-xl p-5
                             hover:border-brand-500/50 hover:bg-surface-700/50
                             transition-all duration-200 hover:shadow-lg hover:shadow-brand-500/10"
                >
                  {/* ── Card header ── */}
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => !isDeleting && navigate(`/room/${room.id}`)}
                    >
                      <div className="text-2xl mb-1">
                        {LANGUAGE_ICONS[room.language] ?? LANGUAGE_ICONS.default}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs px-2 py-0.5 bg-white/5 text-[#888] rounded-full border border-white/10">
                        {room.language}
                      </span>

                      {/* Three-dot menu — all members see it, content differs by role */}
                      <div className="relative" ref={menuOpen ? menuRef : undefined}>
                        <button
                          id={`room-menu-${room.id}`}
                          title="Room options"
                          onClick={(e) => { e.stopPropagation(); setCardMenu(menuOpen ? null : room.id); }}
                          className="w-6 h-6 flex items-center justify-center rounded
                                     opacity-0 group-hover:opacity-100 focus:opacity-100
                                     text-[#888] hover:text-white hover:bg-white/10 transition-all"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="5"  r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="12" cy="19" r="1.5" />
                          </svg>
                        </button>

                        {menuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setCardMenu(null)} />
                            <div className="absolute top-7 right-0 z-50 bg-surface-800 border border-editor-border
                                           rounded-xl py-1 shadow-2xl min-w-[150px] animate-fade-in">
                              {isOwner ? (
                                <>
                                  {/* Owner: Edit */}
                                  <button
                                    id={`edit-room-${room.id}`}
                                    onClick={(e) => { e.stopPropagation(); openEdit(room); }}
                                    className="w-full text-left px-3 py-2 text-xs text-[#ccc]
                                               hover:bg-white/10 transition-colors flex items-center gap-2"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Edit Room
                                  </button>
                                  <div className="border-t border-white/5 my-1" />
                                  {/* Owner: Delete */}
                                  <button
                                    id={`delete-room-${room.id}`}
                                    onClick={(e) => { e.stopPropagation(); handleDeleteRoom(room); }}
                                    className="w-full text-left px-3 py-2 text-xs text-red-400
                                               hover:bg-red-500/10 transition-colors flex items-center gap-2"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete Room
                                  </button>
                                </>
                              ) : (
                                /* Non-owner: Leave */
                                <button
                                  id={`leave-room-${room.id}`}
                                  onClick={(e) => { e.stopPropagation(); handleLeaveRoom(room); }}
                                  className="w-full text-left px-3 py-2 text-xs text-amber-400
                                             hover:bg-amber-500/10 transition-colors flex items-center gap-2"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                  </svg>
                                  Leave Room
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Card body ── */}
                  <div
                    className="cursor-pointer"
                    onClick={() => !isDeleting && navigate(`/room/${room.id}`)}
                  >
                    <h3 className="font-semibold text-white group-hover:text-brand-300 transition-colors mb-1">
                      {isDeleting ? (
                        <span className="flex items-center gap-2 text-red-400">
                          <Spinner size="sm" /> Deleting…
                        </span>
                      ) : room.name}
                    </h3>

                    {room.description && (
                      <p className="text-xs text-[#888] mb-3 line-clamp-2">{room.description}</p>
                    )}

                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
                      <span className="text-xs text-[#666]">
                        {formatDistanceToNow(new Date(room.updatedAt), { addSuffix: true })}
                      </span>
                      <div className="flex items-center gap-2">
                        {isOwner && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-brand-500/20 text-brand-400 rounded">
                            Owner
                          </span>
                        )}
                        <span className="text-xs text-[#666]">
                          {room.isPublic ? '🌐 Public' : '🔒 Private'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Create Room Modal ──────────────────────────────────────────────────── */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Room">
        <form onSubmit={handleCreateRoom} className="space-y-4">
          <RoomFormFields
            values={createForm}
            onChange={(patch) => setCreateForm((f) => ({ ...f, ...patch }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
            <button id="create-room-submit" type="submit" disabled={createLoading} className="btn-primary">
              {createLoading ? <Spinner size="sm" /> : 'Create Room'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Room Modal ────────────────────────────────────────────────────── */}
      <Modal isOpen={!!editRoom} onClose={() => setEditRoom(null)} title="Edit Room">
        <form onSubmit={handleUpdateRoom} className="space-y-4">
          <RoomFormFields
            values={editForm}
            onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditRoom(null)} className="btn-ghost">Cancel</button>
            <button id="edit-room-submit" type="submit" disabled={editLoading} className="btn-primary">
              {editLoading ? <Spinner size="sm" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Join Room Modal ────────────────────────────────────────────────────── */}
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
            <button type="button" onClick={() => setShowJoin(false)} className="btn-ghost">Cancel</button>
            <button id="join-room-submit" type="submit" disabled={joinLoading} className="btn-primary">
              {joinLoading ? <Spinner size="sm" /> : 'Join Room'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ── Shared form fields for Create & Edit ──────────────────────────────────────
interface FormValues { name: string; description: string; language: string; isPublic: boolean; }
interface RoomFormFieldsProps {
  values: FormValues;
  onChange: (patch: Partial<FormValues>) => void;
}

const RoomFormFields: React.FC<RoomFormFieldsProps> = ({ values, onChange }) => (
  <>
    <div>
      <label className="block text-sm font-medium text-[#ccc] mb-1.5">Room Name *</label>
      <input
        type="text"
        value={values.name}
        onChange={(e) => onChange({ name: e.target.value })}
        className="input-field"
        placeholder="My Awesome Project"
        autoFocus
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-[#ccc] mb-1.5">Description</label>
      <textarea
        value={values.description}
        onChange={(e) => onChange({ description: e.target.value })}
        className="input-field resize-none h-20"
        placeholder="What are you building?"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-[#ccc] mb-1.5">Language</label>
      <select
        value={values.language}
        onChange={(e) => onChange({ language: e.target.value })}
        className="input-field"
      >
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </select>
    </div>

    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        id="room-public-toggle"
        checked={values.isPublic}
        onChange={(e) => onChange({ isPublic: e.target.checked })}
        className="w-4 h-4 accent-brand-500"
      />
      <label htmlFor="room-public-toggle" className="text-sm text-[#ccc]">
        Public room (joinable by anyone with the invite code)
      </label>
    </div>
  </>
);
