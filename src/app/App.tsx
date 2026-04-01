import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Share2 } from 'lucide-react';
import { ComponentPalette, type Tool } from './components/ComponentPalette';
import { TopBar } from './components/TopBar';
import type { ViewMode } from './components/ComponentSvg';
import { CircuitCanvas } from './components/CircuitCanvas';
import { Toaster } from './components/ui/sonner';
import { parseCircuitFromUrl } from './utils/circuitUrl';
import { ShareModal } from './components/ShareModal';

const BG = '#edecf0';

/*
  Elektrony na drátech (animace) jsou vypnuté: CircuitCanvas má showWireElectrons výchozí false.
  Kód vykreslení a výpočet wireVertexFlow zůstávají; při true se chová jako dřív.

  Obnovení animace na drátech:
  – Rychle: v CircuitCanvas změň default u showWireElectrons na true, nebo v App přidej
    <CircuitCanvas … showWireElectrons />.
  – S přepínačem v liště: viz dřívější kroky (TopBar props + tlačítko, useState v App,
    předat showWireElectrons na CircuitCanvas, nápověda); git historie „Elektrony v drátech“.
*/

/** Returns true if the primary input device is touch (tablet / phone). */
function useIsTouch() {
  const [isTouch, setIsTouch] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mq as any).addListener(handler);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return () => (mq as any).removeListener(handler);
    }
  }, []);
  return isTouch;
}

/**
 * Computes a scale factor so the toolbar pill always fits within the viewport height.
 * TOOLBAR_H is the natural height of the fully-expanded pill (all items, no submenus).
 * Scale is clamped to [0.65, 1] so the icons never become unreadably small.
 */
const TOOLBAR_H = 620; // approximate natural height in px
const TOOLBAR_MARGIN = 24; // top+bottom margin
function useToolbarScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const compute = () => {
      const available = window.innerHeight - TOOLBAR_MARGIN;
      setScale(Math.min(1, Math.max(0.65, available / TOOLBAR_H)));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);
  return scale;
}

export default function App() {
  const [tool, setTool] = useState<Tool>('select');
  const [viewMode, setViewMode] = useState<ViewMode>('realistic');
  const [clearTrigger, setClearTrigger] = useState(0);
  const [zoom, setZoom] = useState(2);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const isTouch = useIsTouch();
  const toolbarScale = useToolbarScale();

  // Ref filled by CircuitCanvas – returns the shareable URL for the current circuit
  const shareHandlerRef = useRef<(() => string) | null>(null);

  // Detect view-only mode from URL hash on initial load
  const sharedCircuit = useMemo(() => parseCircuitFromUrl(), []);
  const isViewOnly = sharedCircuit !== null;

  const handleShare = useCallback(() => {
    const getUrl = shareHandlerRef.current;
    if (!getUrl) {
      setShareUrl(window.location.href);
      return;
    }
    const url = getUrl();
    setShareUrl(url || window.location.href);
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white">
      <Toaster position="bottom-center" />

      {/* Full-screen canvas */}
      <CircuitCanvas
        tool={isViewOnly ? 'select' : tool}
        viewMode={viewMode}
        clearTrigger={clearTrigger}
        zoom={zoom}
        setTool={setTool}
        setZoom={setZoom}
        isViewOnly={isViewOnly}
        initialState={sharedCircuit ?? undefined}
        shareHandlerRef={shareHandlerRef}
        onPanelOpenChange={setPanelOpen}
        isTouch={isTouch}
      />

      {/* Floating left toolbar
          – overflow: visible so shadow + right-side submenus are never clipped
          – scale transform shrinks the pill on short screens instead of scrolling  */}
      {!isViewOnly && !panelOpen && (
        <div
          className="absolute left-3 z-20"
          style={{
            top: '50%',
            overflow: 'visible',
            transformOrigin: 'left center',
            transform: `translateY(-50%) scale(${toolbarScale})`,
          }}
        >
          <ComponentPalette
            tool={tool}
            onToolChange={setTool}
            onClearAll={() => setClearTrigger(t => t + 1)}
          />
        </div>
      )}

      {/* Floating top center toolbar + Share button */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        <TopBar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          zoom={zoom}
          onZoomChange={setZoom}
          isViewOnly={isViewOnly}
        />

        {/* Share button */}
        <button
          onClick={handleShare}
          title="Sdílet obvod"
          className="flex items-center gap-1.5 rounded-full shadow-lg select-none cursor-pointer hover:brightness-95 active:scale-95 transition-all"
          style={{
            background: BG,
            height: 50,
            padding: '0 18px',
            color: '#1e1b4b',
            touchAction: 'manipulation',
          }}
        >
          <Share2 size={15} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Sdílet</span>
        </button>
      </div>

      {/* Share modal */}
      {shareUrl !== null && (
        <ShareModal url={shareUrl} onClose={() => setShareUrl(null)} />
      )}
    </div>
  );
}