import React, { useState, useRef, useEffect } from 'react';
import { MousePointer2, Hand, Eraser, Trash2, Pencil } from 'lucide-react';
import { PaletteIcon, type ComponentType } from './ComponentSvg';

export type Tool = ComponentType | 'wire' | 'eraser' | 'select' | 'pan';

interface Props {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  onClearAll: () => void;
}

const NAVY = '#1e1b4b';
const BG = '#ffffff';

/** Malý tooltip balónek napravo od tlačítka */
function Tooltip({ label }: { label: string }) {
  return (
    <div
      className="pointer-events-none absolute left-[54px] top-1/2 -translate-y-1/2 z-[9999] flex items-center gap-1"
      style={{ whiteSpace: 'nowrap' }}
    >
      {/* šipka */}
      <div className="w-0 h-0" style={{
        borderTop: '5px solid transparent',
        borderBottom: '5px solid transparent',
        borderRight: '5px solid #1e1b4b',
      }} />
      <div
        className="px-2 py-1 rounded-lg text-white"
        style={{ background: NAVY, fontSize: 12, lineHeight: 1.3 }}
      >
        {label}
      </div>
    </div>
  );
}

export function ComponentPalette({ tool, onToolChange, onClearAll }: Props) {
  const [batteryOpen, setBatteryOpen] = useState(false);
  const batteryRef = useRef<HTMLDivElement>(null);
  const [bulbOpen, setBulbOpen] = useState(false);
  const bulbRef = useRef<HTMLDivElement>(null);
  const [resistorOpen, setResistorOpen] = useState(false);
  const resistorRef = useRef<HTMLDivElement>(null);
  const [ledOpen, setLedOpen] = useState(false);
  const ledRef = useRef<HTMLDivElement>(null);
  const [meterOpen, setMeterOpen] = useState(false);
  const meterRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Close submenu on outside click
  useEffect(() => {
    if (!batteryOpen && !bulbOpen && !resistorOpen && !ledOpen && !meterOpen) return;
    const handler = (e: MouseEvent) => {
      if (batteryOpen && batteryRef.current && !batteryRef.current.contains(e.target as Node)) {
        setBatteryOpen(false);
      }
      if (bulbOpen && bulbRef.current && !bulbRef.current.contains(e.target as Node)) {
        setBulbOpen(false);
      }
      if (resistorOpen && resistorRef.current && !resistorRef.current.contains(e.target as Node)) {
        setResistorOpen(false);
      }
      if (ledOpen && ledRef.current && !ledRef.current.contains(e.target as Node)) {
        setLedOpen(false);
      }
      if (meterOpen && meterRef.current && !meterRef.current.contains(e.target as Node)) {
        setMeterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler as EventListener, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler as EventListener);
    };
  }, [batteryOpen, bulbOpen, resistorOpen, ledOpen, meterOpen]);

  const toggle = (t: Tool) => {
    if (t === 'select' || t === 'pan') {
      onToolChange(t);
    } else {
      onToolChange(tool === t ? 'select' : t);
    }
  };

  // Battery group
  const isBatteryActive = tool === 'battery' || tool === 'battery2' || tool === 'battery3';
  const isBulbActive = tool === 'bulb' || tool === 'bulb2' || tool === 'bulb3';
  const isResistorActive = tool === 'resistor' || tool === 'resistor2' || tool === 'resistor3';
  const isLedActive = tool === 'led' || tool === 'led2' || tool === 'led3';
  const isMeterActive = tool === 'ammeter' || tool === 'voltmeter';

  // Which battery-group icon to display on the main button
  const batteryIconType: ComponentType =
    tool === 'battery3' ? 'battery3' :
    tool === 'battery2' ? 'battery2' :
    'battery';

  // Which LED icon to display on the main button
  const ledIconType: ComponentType =
    tool === 'led3' ? 'led3' :
    tool === 'led2' ? 'led2' :
    'led';

  // Which bulb icon to display on the main button
  const bulbIconType: ComponentType =
    tool === 'bulb3' ? 'bulb3' :
    tool === 'bulb2' ? 'bulb2' :
    'bulb';

  const iconBtn = (t: Tool, children: React.ReactNode, label: string) => {
    const active = tool === t;
    return (
      <div key={t} className="relative" onMouseEnter={() => setHovered(t)} onMouseLeave={() => setHovered(null)}>
        <button
          onClick={() => toggle(t)}
          className="w-[44px] h-[44px] rounded-xl flex items-center justify-center transition-all cursor-pointer"
          style={{
            background: active ? NAVY : 'transparent',
            color: active ? '#fff' : '#52525b',
            touchAction: 'manipulation',
          }}
        >
          {children}
        </button>
        {hovered === t && <Tooltip label={label} />}
      </div>
    );
  };

  const compBtn = (id: ComponentType, label: string) => {
    const active = tool === id;
    return (
      <div key={id} className="relative" onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(null)}>
        <button
          onClick={() => toggle(id)}
          className="w-[44px] h-[44px] rounded-xl flex items-center justify-center transition-all cursor-pointer"
          style={{ background: active ? NAVY : 'transparent', touchAction: 'manipulation' }}
        >
          <div style={{ filter: active ? 'brightness(0) invert(1)' : 'none' }}>
            <PaletteIcon type={id} mode="schema" />
          </div>
        </button>
        {hovered === id && <Tooltip label={label} />}
      </div>
    );
  };

  return (
    <div
      className="flex flex-col items-center py-3 px-[5px] select-none"
      style={{
        width: 80,
        background: BG,
        borderRadius: 999,
        boxShadow: '0 4px 24px rgba(0,0,0,0.13)',
        overflow: 'visible',   /* MUST be visible – submenus & shadow extend outside */
      }}
    >
      {/* ── Select ── */}
      {iconBtn('select', <MousePointer2 size={18} strokeWidth={2.2} />, 'Výběr (V)')}

      {/* ── Pan ── */}
      {iconBtn('pan', <Hand size={18} strokeWidth={2.2} />, 'Posun (H)')}

      {/* ── Separator ── */}
      <div className="w-5 h-px bg-zinc-400/30 my-1.5" />

      {/* ── Wire ── */}
      {iconBtn('wire', <Pencil size={18} strokeWidth={2.2} />, 'Drát')}

      {/* ── Baterie (submenu) ── */}
      <div ref={batteryRef} className="relative" onMouseEnter={() => !batteryOpen && setHovered('battery-group')} onMouseLeave={() => setHovered(null)}>
        <button
          onClick={() => { setBatteryOpen(o => !o); setHovered(null); }}
          className="w-[42px] h-[42px] rounded-xl flex items-center justify-center transition-all cursor-pointer"
          style={{ background: isBatteryActive ? NAVY : 'transparent' }}
        >
          <div style={{ filter: isBatteryActive ? 'brightness(0) invert(1)' : 'none' }}>
            <PaletteIcon type={batteryIconType} mode="schema" />
          </div>
        </button>
        {hovered === 'battery-group' && !batteryOpen && <Tooltip label="Baterie" />}

        {/* ── Submenu ── */}
        {batteryOpen && (
          <div
            className="absolute left-[52px] top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1.5 p-2 rounded-2xl shadow-xl"
            style={{ background: BG, minWidth: 136 }}
          >
            {/* Arrow pointer */}
            <div
              className="absolute -left-[7px] top-1/2 -translate-y-1/2 w-0 h-0"
              style={{
                borderTop: '7px solid transparent',
                borderBottom: '7px solid transparent',
                borderRight: `7px solid ${BG}`,
              }}
            />

            {/* Slabá baterie 4.5 V */}
            <button
              onClick={() => { onToolChange('battery'); setBatteryOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-zinc-100"
              style={{
                background: tool === 'battery' ? NAVY : 'transparent',
                color: tool === 'battery' ? '#fff' : '#3f3f46',
              }}
            >
              <span style={{ filter: tool === 'battery' ? 'brightness(0) invert(1)' : 'none' }}>
                <PaletteIcon type="battery" mode="schema" />
              </span>
              <span className="whitespace-nowrap" style={{ fontSize: 12 }}>
                Baterie <span style={{ opacity: 0.6 }}>4,5 V</span>
              </span>
            </button>

            {/* Silná baterie 9 V */}
            <button
              onClick={() => { onToolChange('battery2'); setBatteryOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-zinc-100"
              style={{
                background: tool === 'battery2' ? NAVY : 'transparent',
                color: tool === 'battery2' ? '#fff' : '#3f3f46',
              }}
            >
              <span style={{ filter: tool === 'battery2' ? 'brightness(0) invert(1)' : 'none' }}>
                <PaletteIcon type="battery2" mode="schema" />
              </span>
              <span className="whitespace-nowrap" style={{ fontSize: 12 }}>
                Baterie <span style={{ opacity: 0.6 }}>9 V</span>
              </span>
            </button>

            {/* Nejsilnější baterie 12 V */}
            <button
              onClick={() => { onToolChange('battery3'); setBatteryOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-zinc-100"
              style={{
                background: tool === 'battery3' ? NAVY : 'transparent',
                color: tool === 'battery3' ? '#fff' : '#3f3f46',
              }}
            >
              <span style={{ filter: tool === 'battery3' ? 'brightness(0) invert(1)' : 'none' }}>
                <PaletteIcon type="battery3" mode="schema" />
              </span>
              <span className="whitespace-nowrap" style={{ fontSize: 12 }}>
                Baterie <span style={{ opacity: 0.6 }}>12 V</span>
              </span>
            </button>

          </div>
        )}
      </div>

      {/* ── Žárovka (submenu) ── */}
      <div ref={bulbRef} className="relative" onMouseEnter={() => !bulbOpen && setHovered('bulb-group')} onMouseLeave={() => setHovered(null)}>
        <button
          onClick={() => { setBulbOpen(o => !o); setHovered(null); }}
          className="w-[42px] h-[42px] rounded-xl flex items-center justify-center transition-all cursor-pointer"
          style={{ background: isBulbActive ? NAVY : 'transparent' }}
        >
          <div style={{ filter: isBulbActive ? 'brightness(0) invert(1)' : 'none' }}>
            <PaletteIcon type={bulbIconType} mode="schema" />
          </div>
        </button>
        {hovered === 'bulb-group' && !bulbOpen && <Tooltip label="Žárovka" />}

        {bulbOpen && (
          <div
            className="absolute left-[52px] top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1.5 p-2 rounded-2xl shadow-xl"
            style={{ background: BG, minWidth: 148 }}
          >
            <div
              className="absolute -left-[7px] top-1/2 -translate-y-1/2 w-0 h-0"
              style={{
                borderTop: '7px solid transparent',
                borderBottom: '7px solid transparent',
                borderRight: `7px solid ${BG}`,
              }}
            />

            {/* Slabá žárovka 4,5 V */}
            <button
              onClick={() => { onToolChange('bulb'); setBulbOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-zinc-100"
              style={{
                background: tool === 'bulb' ? NAVY : 'transparent',
                color: tool === 'bulb' ? '#fff' : '#3f3f46',
              }}
            >
              <span style={{ filter: tool === 'bulb' ? 'brightness(0) invert(1)' : 'none' }}>
                <PaletteIcon type="bulb" mode="schema" />
              </span>
              <span className="whitespace-nowrap" style={{ fontSize: 12 }}>
                Slabá <span style={{ opacity: 0.6 }}>4,5 V</span>
              </span>
            </button>

            {/* Střední žárovka 9 V */}
            <button
              onClick={() => { onToolChange('bulb2'); setBulbOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-zinc-100"
              style={{
                background: tool === 'bulb2' ? NAVY : 'transparent',
                color: tool === 'bulb2' ? '#fff' : '#3f3f46',
              }}
            >
              <span style={{ filter: tool === 'bulb2' ? 'brightness(0) invert(1)' : 'none' }}>
                <PaletteIcon type="bulb2" mode="schema" />
              </span>
              <span className="whitespace-nowrap" style={{ fontSize: 12 }}>
                Střední <span style={{ opacity: 0.6 }}>9 V</span>
              </span>
            </button>

            {/* Silná žárovka 12 V */}
            <button
              onClick={() => { onToolChange('bulb3'); setBulbOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-zinc-100"
              style={{
                background: tool === 'bulb3' ? NAVY : 'transparent',
                color: tool === 'bulb3' ? '#fff' : '#3f3f46',
              }}
            >
              <span style={{ filter: tool === 'bulb3' ? 'brightness(0) invert(1)' : 'none' }}>
                <PaletteIcon type="bulb3" mode="schema" />
              </span>
              <span className="whitespace-nowrap" style={{ fontSize: 12 }}>
                Silná <span style={{ opacity: 0.6 }}>12 V</span>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ── Vypínač ── */}
      {compBtn('switch', 'Vypínač')}

      {/* ── Rezistor (submenu) ── */}
      <div ref={resistorRef} className="relative" onMouseEnter={() => !resistorOpen && setHovered('resistor-group')} onMouseLeave={() => setHovered(null)}>
        <button
          onClick={() => { setResistorOpen(o => !o); setHovered(null); }}
          className="w-[42px] h-[42px] rounded-xl flex items-center justify-center transition-all cursor-pointer"
          style={{ background: isResistorActive ? NAVY : 'transparent' }}
        >
          <div style={{ filter: isResistorActive ? 'brightness(0) invert(1)' : 'none' }}>
            <PaletteIcon type={tool === 'resistor3' ? 'resistor3' : tool === 'resistor2' ? 'resistor2' : 'resistor'} mode="schema" />
          </div>
        </button>
        {hovered === 'resistor-group' && !resistorOpen && <Tooltip label="Rezistor" />}

        {resistorOpen && (
          <div
            className="absolute left-[52px] top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1.5 p-2 rounded-2xl shadow-xl"
            style={{ background: BG, minWidth: 120 }}
          >
            <div
              className="absolute -left-[7px] top-1/2 -translate-y-1/2 w-0 h-0"
              style={{
                borderTop: '7px solid transparent',
                borderBottom: '7px solid transparent',
                borderRight: `7px solid ${BG}`,
              }}
            />

            <button
              onClick={() => { onToolChange('resistor'); setResistorOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-zinc-100"
              style={{
                background: tool === 'resistor' ? NAVY : 'transparent',
                color: tool === 'resistor' ? '#fff' : '#3f3f46',
              }}
            >
              <span style={{ filter: tool === 'resistor' ? 'brightness(0) invert(1)' : 'none' }}>
                <PaletteIcon type="resistor" mode="schema" />
              </span>
              <span className="whitespace-nowrap" style={{ fontSize: 12 }}>
                Slabý <span style={{ opacity: 0.6 }}>50 Ω</span>
              </span>
            </button>

            <button
              onClick={() => { onToolChange('resistor2'); setResistorOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-zinc-100"
              style={{
                background: tool === 'resistor2' ? NAVY : 'transparent',
                color: tool === 'resistor2' ? '#fff' : '#3f3f46',
              }}
            >
              <span style={{ filter: tool === 'resistor2' ? 'brightness(0) invert(1)' : 'none' }}>
                <PaletteIcon type="resistor2" mode="schema" />
              </span>
              <span className="whitespace-nowrap" style={{ fontSize: 12 }}>
                Střední <span style={{ opacity: 0.6 }}>500 Ω</span>
              </span>
            </button>

            <button
              onClick={() => { onToolChange('resistor3'); setResistorOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-zinc-100"
              style={{
                background: tool === 'resistor3' ? NAVY : 'transparent',
                color: tool === 'resistor3' ? '#fff' : '#3f3f46',
              }}
            >
              <span style={{ filter: tool === 'resistor3' ? 'brightness(0) invert(1)' : 'none' }}>
                <PaletteIcon type="resistor3" mode="schema" />
              </span>
              <span className="whitespace-nowrap" style={{ fontSize: 12 }}>
                Silný <span style={{ opacity: 0.6 }}>5 kΩ</span>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ── Měřidla (Ampérmetr / Voltmetr) submenu ── */}
      <div ref={meterRef} className="relative" onMouseEnter={() => !meterOpen && setHovered('meter-group')} onMouseLeave={() => setHovered(null)}>
        <button
          onClick={() => { setMeterOpen(o => !o); setHovered(null); }}
          className="w-[42px] h-[42px] rounded-xl flex items-center justify-center transition-all cursor-pointer"
          style={{ background: isMeterActive ? NAVY : 'transparent' }}
        >
          {/* Circle with letter M */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle
              cx="14" cy="14" r="12"
              stroke={isMeterActive ? '#fff' : '#52525b'}
              strokeWidth="2"
              fill="none"
            />
            <text
              x="14" y="19"
              textAnchor="middle"
              fontSize="13"
              fontWeight="600"
              fontFamily="system-ui, sans-serif"
              fill={isMeterActive ? '#fff' : '#52525b'}
            >M</text>
          </svg>
        </button>
        {hovered === 'meter-group' && !meterOpen && <Tooltip label="Měřidla" />}

        {meterOpen && (
          <div
            className="absolute left-[52px] top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1.5 p-2 rounded-2xl shadow-xl"
            style={{ background: BG, minWidth: 140 }}
          >
            <div
              className="absolute -left-[7px] top-1/2 -translate-y-1/2 w-0 h-0"
              style={{
                borderTop: '7px solid transparent',
                borderBottom: '7px solid transparent',
                borderRight: `7px solid ${BG}`,
              }}
            />

            {/* Ampérmetr */}
            <button
              onClick={() => { onToolChange('ammeter'); setMeterOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-zinc-100"
              style={{
                background: tool === 'ammeter' ? NAVY : 'transparent',
                color: tool === 'ammeter' ? '#fff' : '#3f3f46',
              }}
            >
              <span style={{ filter: tool === 'ammeter' ? 'brightness(0) invert(1)' : 'none' }}>
                <PaletteIcon type="ammeter" mode="schema" />
              </span>
              <span className="whitespace-nowrap" style={{ fontSize: 12 }}>
                Ampérmetr
              </span>
            </button>

            {/* Voltmetr */}
            <button
              onClick={() => { onToolChange('voltmeter'); setMeterOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-zinc-100"
              style={{
                background: tool === 'voltmeter' ? NAVY : 'transparent',
                color: tool === 'voltmeter' ? '#fff' : '#3f3f46',
              }}
            >
              <span style={{ filter: tool === 'voltmeter' ? 'brightness(0) invert(1)' : 'none' }}>
                <PaletteIcon type="voltmeter" mode="schema" />
              </span>
              <span className="whitespace-nowrap" style={{ fontSize: 12 }}>
                Voltmetr
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ── Potenciometr ── */}
      {compBtn('potentiometer', 'Potenciometr')}

      {/* ── LED (submenu) ── */}
      <div ref={ledRef} className="relative" onMouseEnter={() => !ledOpen && setHovered('led-group')} onMouseLeave={() => setHovered(null)}>
        <button
          onClick={() => { setLedOpen(o => !o); setHovered(null); }}
          className="w-[42px] h-[42px] rounded-xl flex items-center justify-center transition-all cursor-pointer"
          style={{ background: isLedActive ? NAVY : 'transparent' }}
        >
          <div style={{ filter: isLedActive ? 'brightness(0) invert(1)' : 'none' }}>
            <PaletteIcon type={ledIconType} mode="schema" />
          </div>
        </button>
        {hovered === 'led-group' && !ledOpen && <Tooltip label="LED" />}

        {/* ── Submenu ── */}
        {ledOpen && (
          <div
            className="absolute left-[52px] top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1.5 p-2 rounded-2xl shadow-xl"
            style={{ background: BG, minWidth: 150 }}
          >
            {/* Arrow pointer */}
            <div
              className="absolute -left-[7px] top-1/2 -translate-y-1/2 w-0 h-0"
              style={{
                borderTop: '7px solid transparent',
                borderBottom: '7px solid transparent',
                borderRight: `7px solid ${BG}`,
              }}
            />

            {/* Červená LED 1.8 V */}
            <button
              onClick={() => { onToolChange('led'); setLedOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-zinc-100"
              style={{
                background: tool === 'led' ? NAVY : 'transparent',
                color: tool === 'led' ? '#fff' : '#3f3f46',
              }}
            >
              <span style={{ filter: tool === 'led' ? 'brightness(0) invert(1)' : 'none' }}>
                <PaletteIcon type="led" mode="schema" />
              </span>
              <span className="whitespace-nowrap" style={{ fontSize: 12 }}>
                Červená <span style={{ opacity: 0.6 }}>1,8 V</span>
              </span>
            </button>

            {/* Zelená LED 2.2 V */}
            <button
              onClick={() => { onToolChange('led2'); setLedOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-zinc-100"
              style={{
                background: tool === 'led2' ? NAVY : 'transparent',
                color: tool === 'led2' ? '#fff' : '#3f3f46',
              }}
            >
              <span style={{ filter: tool === 'led2' ? 'brightness(0) invert(1)' : 'none' }}>
                <PaletteIcon type="led2" mode="schema" />
              </span>
              <span className="whitespace-nowrap" style={{ fontSize: 12 }}>
                Zelená <span style={{ opacity: 0.6 }}>2,2 V</span>
              </span>
            </button>

            {/* Modrá LED 3.0 V */}
            <button
              onClick={() => { onToolChange('led3'); setLedOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-zinc-100"
              style={{
                background: tool === 'led3' ? NAVY : 'transparent',
                color: tool === 'led3' ? '#fff' : '#3f3f46',
              }}
            >
              <span style={{ filter: tool === 'led3' ? 'brightness(0) invert(1)' : 'none' }}>
                <PaletteIcon type="led3" mode="schema" />
              </span>
              <span className="whitespace-nowrap" style={{ fontSize: 12 }}>
                Modrá <span style={{ opacity: 0.6 }}>3,0 V</span>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ── NPN Tranzistor ── */}
      {compBtn('npn', 'NPN Tranzistor')}

      {/* ── Separator ── */}
      <div className="w-5 h-px bg-zinc-400/30 my-1.5" />

      {/* ── Eraser ── */}
      {iconBtn('eraser', <Eraser size={18} strokeWidth={2.2} />, 'Guma (E)')}

      {/* ── Trash ── */}
      <div className="relative" onMouseEnter={() => setHovered('trash')} onMouseLeave={() => setHovered(null)}>
        <button
          onClick={onClearAll}
          className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-zinc-500 hover:text-red-500 hover:bg-red-50/60 transition-all cursor-pointer"
        >
          <Trash2 size={18} strokeWidth={2.2} />
        </button>
        {hovered === 'trash' && <Tooltip label="Smazat vše" />}
      </div>
    </div>
  );
}