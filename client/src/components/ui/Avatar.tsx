import React from 'react';

interface AvatarProps {
  username: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  online?: boolean;
}

const SIZE_MAP = {
  xs: 'w-5 h-5 text-[8px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

export const Avatar: React.FC<AvatarProps> = ({ username, color = '#6366f1', size = 'md', online }) => {
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${SIZE_MAP[size]} rounded-full flex items-center justify-center font-semibold text-white select-none`}
        style={{ backgroundColor: color }}
        title={username}
      >
        {initials}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-surface-900 ${
            online ? 'bg-emerald-400' : 'bg-[#555]'
          }`}
        />
      )}
    </div>
  );
};
