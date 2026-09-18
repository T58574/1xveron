import React, { useRef, useState, useEffect } from 'react';

interface PaneSplitterProps {
  direction: 'vertical' | 'horizontal'; // 'vertical' = adjusts width (col-resize), 'horizontal' = adjusts height (row-resize)
  onResizePercent: (percent: number) => void;
  onReset?: () => void;
  minPercent?: number;
  maxPercent?: number;
  className?: string;
  title?: string;
}

export const PaneSplitter: React.FC<PaneSplitterProps> = ({
  direction,
  onResizePercent,
  onReset,
  minPercent = 15,
  maxPercent = 85,
  className = '',
  title = 'Drag to resize, double-click to reset',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const splitterRef = useRef<HTMLDivElement>(null);
  const lastClickTimeRef = useRef<number>(0);

  // Keep callback fresh in ref across renders during active drag
  const onResizePercentRef = useRef(onResizePercent);
  onResizePercentRef.current = onResizePercent;

  const minPercentRef = useRef(minPercent);
  minPercentRef.current = minPercent;

  const maxPercentRef = useRef(maxPercent);
  maxPercentRef.current = maxPercent;

  const isVert = direction === 'vertical';

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary mouse button / touch
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    // Fast double-click / double-tap detection
    const now = Date.now();
    if (now - lastClickTimeRef.current < 350) {
      lastClickTimeRef.current = 0;
      onReset?.();
      return;
    }
    lastClickTimeRef.current = now;

    const parentEl = splitterRef.current?.parentElement;
    if (!parentEl) return;

    setIsDragging(true);

    const rect = parentEl.getBoundingClientRect();
    const parentStart = isVert ? rect.left : rect.top;
    const parentLength = isVert ? rect.width : rect.height;

    const handlePointerMove = (moveEv: PointerEvent) => {
      moveEv.preventDefault();
      if (parentLength > 0 && onResizePercentRef.current) {
        const currentCoord = isVert ? moveEv.clientX : moveEv.clientY;
        const rawPercent = ((currentCoord - parentStart) / parentLength) * 100;
        const clamped = Math.max(minPercentRef.current, Math.min(maxPercentRef.current, rawPercent));
        onResizePercentRef.current(clamped);
      }
    };

    const handlePointerUp = (upEv: PointerEvent) => {
      upEv.preventDefault();
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = isVert ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp, { passive: false });
    window.addEventListener('pointercancel', handlePointerUp, { passive: false });
  };

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  return (
    <>
      <div
        ref={splitterRef}
        onPointerDown={handlePointerDown}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onReset?.();
        }}
        title={title}
        className={`relative select-none shrink-0 flex items-center justify-center group ${
          isVert
            ? 'w-3 h-full cursor-col-resize -mx-1.5 z-20 hover:z-30'
            : 'h-3 w-full cursor-row-resize -my-1.5 z-20 hover:z-30'
        } ${isDragging ? 'z-50' : ''} ${className}`}
      >
        {/* Visual track line: invisible until hovered or dragging */}
        <div
          className={`rounded-full transition-opacity duration-150 ${
            isVert ? 'w-[2px] h-full' : 'h-[2px] w-full'
          } ${
            isDragging
              ? 'opacity-100 bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.9)]'
              : 'opacity-0 group-hover:opacity-100 bg-amber-400/60 shadow-[0_0_6px_rgba(245,158,11,0.4)]'
          }`}
        />

        {/* Central tactile grab pill: invisible until hovered or dragging */}
        <div
          className={`absolute rounded-full transition-opacity duration-150 ${
            isVert ? 'w-1.5 h-7' : 'h-1.5 w-7'
          } ${
            isDragging
              ? 'opacity-100 bg-amber-400 shadow-[0_0_12px_#f59e0b] scale-110'
              : 'opacity-0 group-hover:opacity-100 bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
          }`}
        />
      </div>

      {/* Global transparent backdrop during drag to lock cursor and prevent iframe/xterm event theft */}
      {isDragging && (
        <div
          className={`fixed inset-0 z-[9999] ${
            isVert ? 'cursor-col-resize' : 'cursor-row-resize'
          } select-none`}
        />
      )}
    </>
  );
};
