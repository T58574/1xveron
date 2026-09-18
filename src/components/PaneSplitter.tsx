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
      className={`relative select-none flex items-center justify-center group transition-all ${
        isVert
          ? 'w-3 h-full cursor-col-resize -mx-1.5 z-20 hover:z-30'
          : 'h-3 w-full cursor-row-resize -my-1.5 z-20 hover:z-30'
      } ${isDragging ? 'z-40' : ''} ${className}`}
    >
      {/* Visual track line: 100% invisible until hovered or dragging */}
      <div
        className={`transition-all duration-200 rounded-full ${
          isVert ? 'w-[2px] h-full' : 'h-[2px] w-full'
        } ${
          isDragging
            ? 'opacity-100 bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.9)]'
            : 'opacity-0 group-hover:opacity-100 bg-amber-400/60 shadow-[0_0_6px_rgba(245,158,11,0.4)]'
        }`}
      />

      {/* Central tactile grab pill: 100% invisible until hovered or dragging */}
      <div
        className={`absolute rounded-full transition-all duration-200 ${
          isVert ? 'w-1 h-6' : 'h-1 w-6'
        } ${
          isDragging
            ? 'opacity-100 bg-amber-400 shadow-[0_0_12px_#f59e0b] scale-110'
            : 'opacity-0 group-hover:opacity-100 bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
        }`}
      />
    </div>
  );
};
