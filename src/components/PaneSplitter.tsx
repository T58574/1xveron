import React, { useRef, useState } from 'react';

interface PaneSplitterProps {
  direction: 'vertical' | 'horizontal'; // 'vertical' = adjusts width (col-resize), 'horizontal' = adjusts height (row-resize)
  onResize: (deltaPercent: number) => void;
  onReset?: () => void;
  className?: string;
  title?: string;
}

export const PaneSplitter: React.FC<PaneSplitterProps> = ({
  direction,
  onResize,
  onReset,
  className = '',
  title = 'Drag to resize, double-click to reset (50/50)',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startCoordRef = useRef<number>(0);
  const splitterRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);

    const isVert = direction === 'vertical';
    startCoordRef.current = isVert ? e.clientX : e.clientY;

    const parentEl = splitterRef.current?.parentElement;
    const parentDimension = parentEl
      ? isVert
        ? parentEl.clientWidth
        : parentEl.clientHeight
      : isVert
      ? window.innerWidth
      : window.innerHeight;

    const handlePointerMove = (moveEv: PointerEvent) => {
      const currentCoord = isVert ? moveEv.clientX : moveEv.clientY;
      const deltaPx = currentCoord - startCoordRef.current;
      startCoordRef.current = currentCoord;

      if (parentDimension > 0) {
        const deltaPercent = (deltaPx / parentDimension) * 100;
        onResize(deltaPercent);
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = isVert ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const isVert = direction === 'vertical';

  return (
    <div
      ref={splitterRef}
      onPointerDown={handlePointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onReset?.();
      }}
      title={title}
      className={`relative select-none flex items-center justify-center transition-colors ${
        isVert
          ? 'w-2 h-full cursor-col-resize -mx-1 z-20 hover:z-30'
          : 'h-2 w-full cursor-row-resize -my-1 z-20 hover:z-30'
      } ${isDragging ? 'z-40' : ''} ${className}`}
    >
      {/* Visual track line */}
      <div
        className={`transition-colors duration-150 rounded-full ${
          isVert
            ? 'w-[2px] h-full'
            : 'h-[2px] w-full'
        } ${
          isDragging
            ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
            : 'bg-white/[0.08] hover:bg-amber-400/70'
        }`}
      />

      {/* Central tactile grab pill */}
      <div
        className={`absolute rounded-full transition-all duration-150 ${
          isVert
            ? 'w-1 h-5'
            : 'h-1 w-5'
        } ${
          isDragging
            ? 'bg-amber-400 shadow-[0_0_10px_#f59e0b]'
            : 'bg-white/30 hover:bg-amber-400'
        }`}
      />
    </div>
  );
};
