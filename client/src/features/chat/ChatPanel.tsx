import React, { useEffect, useRef, useState } from 'react';
import { getSocket } from '../../config/socket';
import { useAuthStore } from '../../store/authStore';
import { chatService } from './chatService';
import { ChatMessage } from '../../types/chat.types';
import { Avatar } from '../../components/ui/Avatar';
import { formatDistanceToNow } from 'date-fns';

interface ChatPanelProps {
  roomId: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ roomId }) => {
  const { user } = useAuthStore();
  const socket = getSocket();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);

  // Load message history
  useEffect(() => {
    (async () => {
      try {
        const history = await chatService.getMessages(roomId);
        setMessages(history);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [roomId]);

  // Socket listeners
  useEffect(() => {
    const onMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    const onTyping = ({ usernames }: { userIds: string[]; usernames: string[] }) => {
      setTypingUsers(usernames.filter((u) => u !== user?.username));
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:typing-users', onTyping);

    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:typing-users', onTyping);
    };
  }, [socket, user?.username]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    socket.emit('chat:send', { roomId, content: input.trim() });
    setInput('');

    // Stop typing indicator
    if (typingTimer.current) clearTimeout(typingTimer.current);
    socket.emit('chat:typing-stop', { roomId });
    isTyping.current = false;
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);

    if (!isTyping.current) {
      socket.emit('chat:typing-start', { roomId });
      isTyping.current = true;
    }

    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit('chat:typing-stop', { roomId });
      isTyping.current = false;
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header flex-shrink-0">
        <span>Chat</span>
        <span className="text-[#555] normal-case font-normal tracking-normal">
          {messages.length} messages
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-xs text-[#555] py-8">
            No messages yet. Say hello! 👋
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.userId === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} animate-fade-in`}
              >
                <Avatar username={msg.username} color={msg.avatarColor} size="xs" />
                <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  <div className={`flex items-center gap-1.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs font-medium text-[#aaa]">{msg.username}</span>
                    <span className="text-[10px] text-[#555]">
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div
                    className={`text-sm px-3 py-1.5 rounded-2xl ${
                      isOwn
                        ? 'bg-brand-600 text-white rounded-tr-sm'
                        : 'bg-surface-700 text-[#d4d4d4] rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-3 py-1 text-xs text-[#888] italic flex-shrink-0">
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing
          <span className="animate-pulse-soft">…</span>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-editor-border flex gap-2 flex-shrink-0">
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={handleTyping}
          placeholder="Message…"
          className="flex-1 bg-surface-900 border border-editor-border text-[#d4d4d4] text-sm
                     rounded-lg px-3 py-1.5 outline-none focus:border-brand-500 transition-colors"
          maxLength={1000}
        />
        <button
          id="chat-send-btn"
          type="submit"
          disabled={!input.trim()}
          className="p-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed
                     rounded-lg text-white transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
};
