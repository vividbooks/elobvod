import { useState, useMemo, useRef, useCallback } from 'react';
import { Share2, ClipboardList } from 'lucide-react';
import { ComponentPalette, type Tool } from './components/ComponentPalette';
import { TopBar } from './components/TopBar';
import type { ViewMode } from './components/ComponentSvg';
import { CircuitCanvas } from './components/CircuitCanvas';
import { Toaster } from './components/ui/sonner';
import { parseCircuitFromUrl } from './utils/circuitUrl';
import { ShareModal } from './components/ShareModal';
import { TasksSheet } from '@/features/tasks';
import { useIsTouch, useToolbarScale } from './hooks/editorChrome';

const BG = '#ffffff';

export default function HomePage() {
  const [tool, setTool] = useState<Tool>('select');
  const [viewMode, setViewMode] = useState<ViewMode>('realistic');
  const [clearTrigger, setClearTrigger] = useState(0);
  const [zoom, setZoom] = useState(2);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const isTouch = useIsTouch();
  const toolbarScale = useToolbarScale();

  const shareHandlerRef = useRef<(() => string) | null>(null);

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
    <>
      {/* overflow jen na plátně – horní lišta je fixed, jinak by stíny ořezával overflow-hidden */}
      <div className="relative min-h-screen w-full overflow-hidden bg-white">
        <Toaster position="bottom-center" />

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
      </div>

      {/* top-3 = stejná úroveň jako Zpět/Vpřed v CircuitCanvas; pb-4 = místo pod shadow-lg při overflow-x-auto */}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-20 flex justify-center px-2">
        <div
          className="pointer-events-auto max-w-[calc(100vw-8px)] overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex shrink-0 items-center justify-center gap-1.5 px-3">
            <TopBar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              zoom={zoom}
              onZoomChange={setZoom}
              isViewOnly={isViewOnly}
            />

            {!isViewOnly && (
              <button
                type="button"
                onClick={() => setTasksOpen(true)}
                title="Úkoly – vytvořit zadání"
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200/80 shadow-lg select-none cursor-pointer transition-all hover:bg-zinc-100 active:scale-95"
                style={{
                  background: BG,
                  height: 50,
                  padding: '0 16px',
                  color: '#1e1b4b',
                  touchAction: 'manipulation',
                }}
              >
                <ClipboardList size={15} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Úkoly</span>
              </button>
            )}

            <button
              onClick={handleShare}
              title="Sdílet obvod"
              className="flex h-[50px] w-[50px] shrink-0 items-center justify-center gap-0 rounded-full px-0 shadow-lg select-none transition-all hover:brightness-95 active:scale-95 md:h-[50px] md:w-auto md:justify-start md:gap-1.5 md:px-[18px]"
              style={{
                background: BG,
                color: '#1e1b4b',
                touchAction: 'manipulation',
              }}
            >
              <Share2 size={15} className="shrink-0" aria-hidden />
              <span className="hidden text-xs font-semibold md:inline">Sdílet</span>
            </button>
          </div>
        </div>
      </div>

      <TasksSheet open={tasksOpen} onOpenChange={setTasksOpen} />

      {shareUrl !== null && (
        <ShareModal url={shareUrl} onClose={() => setShareUrl(null)} />
      )}
    </>
  );
}
