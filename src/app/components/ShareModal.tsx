import React, { useState, useRef, useEffect } from 'react';
import { X, Copy, Check, Link } from 'lucide-react';

interface Props {
  url: string;
  onClose: () => void;
}

export function ShareModal({ url, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Select all text on open
  useEffect(() => {
    inputRef.current?.select();
  }, []);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback: select + execCommand
      inputRef.current?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Card */}
      <div
        className="relative rounded-2xl shadow-2xl flex flex-col gap-4"
        style={{ background: '#f5f4f8', width: 'min(420px, calc(100vw - 32px))', padding: '28px 28px 24px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2" style={{ color: '#1e1b4b' }}>
            <Link size={16} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>Sdílet obvod</span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full transition-colors"
            style={{ width: 30, height: 30, color: '#9ca3af', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#e5e7eb')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Zkopíruj odkaz a pošli ho komukoliv – příjemce uvidí přesně tento obvod&nbsp;(přepínače fungují, nic nelze upravovat).
        </p>

        {/* URL row */}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            readOnly
            value={url}
            onClick={() => inputRef.current?.select()}
            className="flex-1 rounded-xl border outline-none text-ellipsis"
            style={{
              background: '#ffffff',
              border: '1.5px solid #e5e7eb',
              padding: '10px 12px',
              fontSize: 12,
              color: '#374151',
              fontFamily: 'monospace',
              minWidth: 0,
            }}
          />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-xl transition-all active:scale-95 select-none cursor-pointer flex-shrink-0"
            style={{
              background: copied ? '#22c55e' : '#1e1b4b',
              color: '#fff',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {copied ? <><Check size={14} />Zkopírováno</> : <><Copy size={14} />Kopírovat</>}
          </button>
        </div>
      </div>
    </div>
  );
}