import React, { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../config/socket';

interface PresenceBarProps {
  roomId: string;
}

const IDLE_TIMEOUT_MS = 30_000; // 30 seconds

/** Darken a hex color slightly for idle state */
function withOpacity(color: string, opacity: number): string {
  // If color is in #rrggbb form, convert to rgba
  const hex = color?.replace('#', '');
  if (!hex || hex.length < 6) return color ?? '#888';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export const PresenceBar: React.FC<PresenceBarProps> = ({ roomId }) => {
  const socket = getSocket();
  const { user } = useAuthStore();
  const { members, onlineUserIds, userActivity, setUserActivity } = useRoomStore();
  const [localIdle, setLocalIdle] = useState(false);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onlineMembers = members.filter((m) => onlineUserIds.has(m.userId));

  // ── Remote presence events ────────────────────────────────────────────────
  useEffect(() => {
    const onIdle   = ({ userId }: { userId: string }) => setUserActivity(userId, 'idle');
    const onActive = ({ userId }: { userId: string }) => setUserActivity(userId, 'active');

    socket.on('presence:remote-idle',   onIdle);
    socket.on('presence:remote-active', onActive);
    return () => {
      socket.off('presence:remote-idle',   onIdle);
      socket.off('presence:remote-active', onActive);
    };
  }, [socket, setUserActivity]);

  // ── Local idle detection ──────────────────────────────────────────────────
  useEffect(() => {
    function resetIdle() {
      if (localIdle) {
        setLocalIdle(false);
        setUserActivity(user?.id ?? '', 'active');
        socket.emit('presence:active', { roomId });
      }
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        setLocalIdle(true);
        setUserActivity(user?.id ?? '', 'idle');
        socket.emit('presence:idle', { roomId });
      }, IDLE_TIMEOUT_MS);
    }

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown',   resetIdle);
    resetIdle(); // kick off on mount

    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown',   resetIdle);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [localIdle, roomId, socket, user?.id, setUserActivity]);

  return (
    <div className="flex items-center gap-0.5">
      {onlineMembers.map((m) => {
        const isLocal  = m.userId === user?.id;
        const activity = isLocal ? (localIdle ? 'idle' : 'active') : (userActivity.get(m.userId) ?? 'active');
        const isIdle   = activity === 'idle';
        const initial  = m.username.charAt(0).toUpperCase();
        const color    = m.avatarColor ?? '#6366f1';
        const ringColor = isIdle ? withOpacity(color, 0.35) : color;

        return (
          <div
            key={m.userId}
            className="relative cursor-default"
            onMouseEnter={() => setTooltip(m.userId)}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Avatar circle */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                         transition-all duration-300"
              style={{
                backgroundColor: withOpacity(color, isIdle ? 0.3 : 1),
                color: isIdle ? withOpacity(color, 0.6) : '#000',
                boxShadow: `0 0 0 2px ${ringColor}`,
                filter: isIdle ? 'grayscale(0.4)' : 'none',
              }}
            >
              {initial}
            </div>

            {/* Idle moon badge */}
            {isIdle && (
              <span className="absolute -bottom-0.5 -right-0.5 text-[9px] leading-none select-none">
                💤
              </span>
            )}

            {/* Tooltip */}
            {tooltip === m.userId && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50
                              bg-surface-800 border border-editor-border rounded-lg px-2 py-1.5
                              shadow-xl whitespace-nowrap text-[11px] pointer-events-none animate-fade-in">
                <span className="text-white font-medium">
                  {m.username}{isLocal ? ' (you)' : ''}
                </span>
                <br />
                <span className={isIdle ? 'text-[#888]' : 'text-emerald-400'}>
                  {isIdle ? '💤 idle' : '● active'}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
