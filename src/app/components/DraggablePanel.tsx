import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface DraggablePanelProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  accentColor?: string;
}

export function DraggablePanel({ title, onClose, children, accentColor = '#4f46e5' }: DraggablePanelProps) {
  // position relative to viewport; null = use default (left: 12, centred vertically)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef<{
    startX: number; startY: number;
    startPx: number; startPy: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Clamp position so panel stays inside the viewport
  const clamp = useCallback((x: number, y: number) => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const pw = panelRef.current?.offsetWidth ?? 236;
    const ph = panelRef.current?.offsetHeight ?? 320;
    return {
      x: Math.max(0, Math.min(W - pw, x)),
      y: Math.max(0, Math.min(H - ph, y)),
    };
  }, []);

  // ── Mouse drag ──────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return; // don't drag on buttons
    e.preventDefault();
    const rect = panelRef.current!.getBoundingClientRect();
    dragState.current = { startX: e.clientX, startY: e.clientY, startPx: rect.left, startPy: rect.top };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      const { startX, startY, startPx, startPy } = dragState.current;
      setPos(clamp(startPx + e.clientX - startX, startPy + e.clientY - startY));
    };
    const onUp = () => { dragState.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [clamp]);

  // ── Touch drag ──────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const t = e.touches[0];
    const rect = panelRef.current!.getBoundingClientRect();
    dragState.current = { startX: t.clientX, startY: t.clientY, startPx: rect.left, startPy: rect.top };
  }, []);

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (!dragState.current) return;
      // Only prevent default if we're actually dragging the panel
      e.preventDefault();
      const t = e.touches[0];
      const { startX, startY, startPx, startPy } = dragState.current;
      setPos(clamp(startPx + t.clientX - startX, startPy + t.clientY - startY));
    };
    const onTouchEnd = () => { dragState.current = null; };
    // passive: false needed to call preventDefault
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [clamp]);

  // Default position: left side, vertically centred
  const defaultStyle: React.CSSProperties = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, zIndex: 50, width: 236 }
    : { position: 'fixed', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 50, width: 236 };

  return (
    <div
      ref={panelRef}
      style={defaultStyle}
      className="bg-white rounded-2xl shadow-2xl border border-gray-200 select-none"
    >
      {/* ── Title bar (drag handle) ── */}
      <div
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        className="flex items-center justify-between px-4 py-3 rounded-t-2xl"
        style={{
          borderBottom: `2px solid ${accentColor}18`,
          background: `${accentColor}08`,
          cursor: 'grab',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1e1b4b' }}>{title}</span>
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          style={{ width: 32, height: 32, color: '#9ca3af', touchAction: 'manipulation' }}
          title="Zavřít"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pb-4 pt-3">
        {children}
      </div>
    </div>
  );
}
