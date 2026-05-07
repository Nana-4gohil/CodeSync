import React, { useRef, useState, useCallback, useEffect } from 'react';

interface ResizablePanelProps {
  children: [React.ReactNode, React.ReactNode];
  direction?: 'horizontal' | 'vertical';
  defaultSize?: number; // percentage for first panel
  minSize?: number;
  maxSize?: number;
  className?: string;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  direction = 'horizontal',
  defaultSize = 25,
  minSize = 10,
  maxSize = 70,
  className = '',
}) => {
  const [size, setSize] = useState(defaultSize);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const handleRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let newSize: number;

      if (direction === 'horizontal') {
        newSize = ((e.clientX - rect.left) / rect.width) * 100;
      } else {
        newSize = ((e.clientY - rect.top) / rect.height) * 100;
      }

      setSize(Math.min(maxSize, Math.max(minSize, newSize)));
    },
    [direction, minSize, maxSize],
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    handleRef.current?.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleMouseDown = () => {
    isDragging.current = true;
    handleRef.current?.classList.add('dragging');
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      ref={containerRef}
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} ${className} overflow-hidden`}
    >
      {/* First panel */}
      <div
        style={isHorizontal ? { width: `${size}%` } : { height: `${size}%` }}
        className="flex-shrink-0 overflow-hidden"
      >
        {children[0]}
      </div>

      {/* Drag handle */}
      <div
        ref={handleRef}
        className={isHorizontal ? 'resize-handle' : 'resize-handle resize-handle-horizontal'}
        onMouseDown={handleMouseDown}
      />

      {/* Second panel */}
      <div className="flex-1 overflow-hidden min-w-0 min-h-0">
        {children[1]}
      </div>
    </div>
  );
};
