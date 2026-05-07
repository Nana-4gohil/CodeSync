import React from 'react';
import clsx from 'clsx';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-[3px]',
};

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className }) => (
  <div
    className={clsx(
      SIZE_MAP[size],
      'border-current border-t-transparent rounded-full animate-spin',
      className,
    )}
  />
);
