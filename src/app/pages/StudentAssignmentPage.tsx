import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'react-router';
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { ComponentPalette, type Tool } from '../components/ComponentPalette';
import { TopBar } from '../components/TopBar';
import type { ViewMode } from '../components/ComponentSvg';
import { CircuitCanvas } from '../components/CircuitCanvas';
import { Toaster } from '../components/ui/sonner';
import { ShareModal } from '../components/ShareModal';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { getSupabase } from '@/lib/supabase';
import { CIRCUIT_ASSIGNMENTS_TABLE, CIRCUIT_SUBMISSIONS_TABLE } from '@/lib/circuitTables';
import { submissionPublicUrl } from '../utils/appUrl';
import { assignmentInstructionDisplay } from '../utils/instructionSteps';
import { useIsTouch, useToolbarScale } from '../hooks/editorChrome';
import { toast } from 'sonner';

const BG = '#ffffff';

const ASIDE_W_KEY = 'elobvod-student-aside-w';
const ASIDE_COLLAPSED_KEY = 'elobvod-student-aside-collapsed';
const NOTE_KEY_PREFIX = 'elobvod-student-note-';
const MIN_ASIDE_PX = 200;
const MAX_ASIDE_PX = 640;
const DEFAULT_ASIDE_PX = 288;

function readAsideWidth(): number {
  if (typeof sessionStorage === 'undefined') return DEFAULT_ASIDE_PX;
  const v = Number(sessionStorage.getItem(ASIDE_W_KEY));
  return Number.isFinite(v) && v >= MIN_ASIDE_PX && v <= MAX_ASIDE_PX ? v : DEFAULT_ASIDE_PX;
}

function readAsideCollapsed(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(ASIDE_COLLAPSED_KEY) === '1';
}

function nameStorageKey(assignmentId: string) {
  return `elobvod-ukol-jmeno-${assignmentId}`;
}

function noteStorageKey(assignmentId: string) {
  return `${NOTE_KEY_PREFIX}${assignmentId}`;
}

type AssignmentRow = {
  id: string;
  title?: string;
  instruction_text: string;
  instruction_image: string | null;
  instruction_steps?: unknown;
};

export default function StudentAssignmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [tool, setTool] = useState<Tool>('select');
  const [viewMode, setViewMode] = useState<ViewMode>('realistic');
  const [clearTrigger, setClearTrigger] = useState(0);
  const [zoom, setZoom] = useState(2);
  const [panelOpen, setPanelOpen] = useState(false);
  const isTouch = useIsTouch();
  const toolbarScale = useToolbarScale();

  const shareHandlerRef = useRef<(() => string) | null>(null);

  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const [gateName, setGateName] = useState('');
  const [studentName, setStudentName] = useState<string | null>(null);
  const [submitNameOpen, setSubmitNameOpen] = useState(false);
  const [studentNote, setStudentNote] = useState('');

  const [submitBusy, setSubmitBusy] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const [asideWidth, setAsideWidth] = useState(readAsideWidth);
  const [asideCollapsed, setAsideCollapsed] = useState(readAsideCollapsed);
  const asideResizeRef = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    sessionStorage.setItem(ASIDE_W_KEY, String(asideWidth));
  }, [asideWidth]);

  useEffect(() => {
    sessionStorage.setItem(ASIDE_COLLAPSED_KEY, asideCollapsed ? '1' : '0');
  }, [asideCollapsed]);

  const onAsideResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    asideResizeRef.current = { startX: e.clientX, startW: asideWidth };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onAsideResizePointerMove = (e: React.PointerEvent) => {
    const drag = asideResizeRef.current;
    if (!drag) return;
    const next = drag.startW + (drag.startX - e.clientX);
    setAsideWidth(Math.min(MAX_ASIDE_PX, Math.max(MIN_ASIDE_PX, next)));
  };

  const onAsideResizePointerUp = (e: React.PointerEvent) => {
    asideResizeRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!assignmentId) {
      setLoadState('error');
      return;
    }
    const saved = sessionStorage.getItem(nameStorageKey(assignmentId));
    if (saved?.trim()) setStudentName(saved.trim());
    const savedNote = sessionStorage.getItem(noteStorageKey(assignmentId));
    if (savedNote != null) setStudentNote(savedNote);

    const supabase = getSupabase();
    if (!supabase) {
      setLoadState('error');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from(CIRCUIT_ASSIGNMENTS_TABLE)
          .select('*')
          .eq('id', assignmentId)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          setLoadState('error');
          return;
        }
        setAssignment(data as AssignmentRow);
        setStepIndex(0);
        setLoadState('ready');
      } catch (e) {
        if (!cancelled) {
          console.error('Načtení zadání (Supabase):', e);
          setLoadState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  const performSubmit = useCallback(async (encoded: string, name: string) => {
    const supabase = getSupabase();
    if (!supabase || !assignmentId) {
      toast.error('Nelze odevzdat – chybí Supabase nebo úkol.');
      return;
    }

    setSubmitBusy(true);
    try {
      const { data, error } = await supabase
        .from(CIRCUIT_SUBMISSIONS_TABLE)
        .insert({
          assignment_id: assignmentId,
          student_name: name,
          circuit_encoded: encoded,
          student_note: studentNote.trim(),
        })
        .select('id')
        .single();

      if (error) throw error;
      if (!data?.id) throw new Error('Chybí ID odevzdání');

      setResultUrl(submissionPublicUrl(data.id));
      toast.success('Odevzdáno – zkopíruj odkaz pro učitele.');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Odevzdání se nepovedlo.');
    } finally {
      setSubmitBusy(false);
    }
  }, [assignmentId, studentNote]);

  const handleSubmit = useCallback(() => {
    const fn = shareHandlerRef.current;
    if (!fn) {
      toast.error('Editor není připravený – zkus znovu za chvíli.');
      return;
    }
    const url = fn();
    const m = url.match(/#circuit=([^&]+)/);
    const encoded = m?.[1];
    if (!encoded) {
      toast.error('Obvod je prázdný – přidej aspoň jednu součástku nebo drát.');
      return;
    }

    const saved =
      assignmentId ? sessionStorage.getItem(nameStorageKey(assignmentId))?.trim() : '';
    const known = studentName?.trim() || saved;
    if (known) {
      void performSubmit(encoded, known);
      return;
    }

    setGateName(saved ?? '');
    setSubmitNameOpen(true);
  }, [assignmentId, studentName, performSubmit]);

  const confirmNameAndSubmit = useCallback(() => {
    const n = gateName.trim();
    if (!n) {
      toast.error('Zadej jméno');
      return;
    }
    if (assignmentId) sessionStorage.setItem(nameStorageKey(assignmentId), n);
    setStudentName(n);

    const fn = shareHandlerRef.current;
    if (!fn) {
      setSubmitNameOpen(false);
      return;
    }
    const url = fn();
    const m = url.match(/#circuit=([^&]+)/);
    const encoded = m?.[1];
    if (!encoded) {
      toast.error('Obvod je prázdný – přidej aspoň jednu součástku nebo drát.');
      setSubmitNameOpen(false);
      return;
    }
    setSubmitNameOpen(false);
    void performSubmit(encoded, n);
  }, [assignmentId, gateName, performSubmit]);

  if (!assignmentId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-600 p-6">
        Neplatný odkaz na úkol.
      </div>
    );
  }

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        Načítám zadání…
      </div>
    );
  }

  if (loadState === 'error' || !assignment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 p-6 text-center text-zinc-600">
        <p>Zadání se nepodařilo načíst.</p>
        <p className="text-sm text-zinc-400">Zkontroluj odkaz, Supabase a proměnné prostředí.</p>
      </div>
    );
  }

  const instructionView = assignmentInstructionDisplay(assignment);
  const stepsCount = instructionView.kind === 'steps' ? instructionView.steps.length : 0;
  const activeStep =
    instructionView.kind === 'steps' && stepsCount > 0
      ? instructionView.steps[Math.min(Math.max(0, stepIndex), stepsCount - 1)]
      : null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      <Toaster position="bottom-center" />

      <div className="flex-1 relative min-w-0 overflow-hidden">
        <CircuitCanvas
          tool={tool}
          viewMode={viewMode}
          clearTrigger={clearTrigger}
          zoom={zoom}
          setTool={setTool}
          setZoom={setZoom}
          isViewOnly={false}
          shareHandlerRef={shareHandlerRef}
          onPanelOpenChange={setPanelOpen}
          isTouch={isTouch}
        />

        {!panelOpen && (
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

        <div
          className="absolute top-3 left-1/2 z-20 flex max-w-[calc(100%-12px)] -translate-x-1/2 flex-nowrap items-center justify-center overflow-x-auto overflow-y-visible py-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="shrink-0">
            <TopBar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              zoom={zoom}
              onZoomChange={setZoom}
              isViewOnly={false}
            />
          </div>
        </div>

      </div>

      {asideCollapsed ? (
        <button
          type="button"
          onClick={() => setAsideCollapsed(false)}
          className="flex shrink-0 flex-col items-center justify-center gap-1.5 border-l border-zinc-200 bg-zinc-50/95 px-2 py-4 text-zinc-600 shadow-[inset_1px_0_0_rgba(255,255,255,0.6)] transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          title="Zobrazit panel se zadáním"
          aria-label="Zobrazit panel se zadáním"
          aria-expanded={false}
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          <span
            className="text-[10px] font-semibold uppercase tracking-wider text-center leading-tight [writing-mode:vertical-rl]"
          >
            Zobrazit zadání
          </span>
        </button>
      ) : (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Změnit šířku panelu zadání"
            className="group relative z-30 flex w-3 shrink-0 cursor-col-resize select-none justify-center border-l border-r border-zinc-200/80 bg-zinc-100/90 hover:bg-zinc-200/90"
            onPointerDown={onAsideResizePointerDown}
            onPointerMove={onAsideResizePointerMove}
            onPointerUp={onAsideResizePointerUp}
            onPointerCancel={onAsideResizePointerUp}
          >
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-11 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-md ring-1 ring-zinc-900/5 transition-[box-shadow,transform] group-hover:shadow-lg group-active:scale-95"
              aria-hidden
            >
              <GripVertical className="size-3 text-zinc-400 group-hover:text-zinc-500" strokeWidth={2} />
            </div>
          </div>

          <aside
            className="flex min-w-0 shrink-0 flex-col border-l border-zinc-200 bg-zinc-50/90"
            style={{ width: asideWidth }}
            aria-expanded
          >
            <div className="flex items-center justify-between gap-2 border-b border-zinc-200/80 px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Zadání</div>
                {assignment.title?.trim() ? (
                  <div className="truncate text-sm font-semibold text-zinc-900">{assignment.title.trim()}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setAsideCollapsed(true)}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200/80 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                title="Schovat panel se zadáním (zůstane úzký proužek vpravo)"
                aria-label="Skrýt panel se zadáním"
              >
                <span className="whitespace-nowrap">Skrýt panel</span>
                <ChevronRight className="size-3.5 shrink-0 opacity-80" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
              {instructionView.kind === 'steps' ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      KROK {Math.min(stepIndex + 1, stepsCount)} / {stepsCount}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStepIndex(i => Math.max(0, i - 1))}
                        disabled={stepIndex <= 0}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Předchozí
                      </button>
                      <button
                        type="button"
                        onClick={() => setStepIndex(i => Math.min(stepsCount - 1, i + 1))}
                        disabled={stepIndex >= stepsCount - 1}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Další
                      </button>
                    </div>
                  </div>

                  {activeStep ? (
                    <div className="space-y-2">
                      <div className="text-lg leading-relaxed text-zinc-800 whitespace-pre-wrap">
                        {activeStep.text}
                      </div>
                      {activeStep.image ? (
                        <img
                          src={activeStep.image}
                          alt=""
                          className="rounded-lg border border-zinc-200 w-full object-contain max-h-[40vh]"
                        />
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">—</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-lg leading-relaxed text-zinc-800 whitespace-pre-wrap">
                    {instructionView.text || '—'}
                  </p>
                  {assignment.instruction_image ? (
                    <img
                      src={assignment.instruction_image}
                      alt="Zadání"
                      className="rounded-lg border border-zinc-200 w-full object-contain max-h-[40vh]"
                    />
                  ) : null}
                </>
              )}

              <div className="pt-1 border-t border-zinc-200" />
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-zinc-500">Poznámka pro učitele (volitelné)</div>
                <textarea
                  value={studentNote}
                  onChange={e => {
                    const v = e.target.value;
                    setStudentNote(v);
                    if (assignmentId) sessionStorage.setItem(noteStorageKey(assignmentId), v);
                  }}
                  placeholder="Např. co bylo nejasné, co jsi zkoušel(a)…"
                  rows={3}
                  className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none ring-indigo-500/0 transition-shadow focus-visible:ring-2 focus-visible:ring-indigo-400"
                />
              </div>
              {studentName ? (
                <div className="text-xs text-zinc-500 pt-1 border-t border-zinc-200">Student: {studentName}</div>
              ) : (
                <p className="text-xs text-zinc-400 pt-1 border-t border-zinc-200">
                  Jméno doplníš při odevzdání.
                </p>
              )}
            </div>

            <div className="shrink-0 border-t border-zinc-200 bg-zinc-50/95 p-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitBusy}
                className="w-full rounded-xl px-4 py-3 text-sm font-semibold shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ background: BG, color: '#1e1b4b', border: '1px solid rgb(228 228 231)' }}
              >
                {submitBusy ? 'Odevzdávám…' : 'Odevzdat cvičení'}
              </button>
            </div>
          </aside>
        </>
      )}

      <Dialog open={submitNameOpen} onOpenChange={setSubmitNameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Odevzdat cvičení</DialogTitle>
            <DialogDescription>
              Napiš své jméno – učitel ho uvidí u odevzdání. Obvod se odešle tak, jak ho máš teď na plátně.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="submit-student-name">Jméno</Label>
            <Input
              id="submit-student-name"
              value={gateName}
              onChange={e => setGateName(e.target.value)}
              placeholder="Jan Novák"
              autoComplete="name"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && confirmNameAndSubmit()}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSubmitNameOpen(false)}>
              Zrušit
            </Button>
            <Button type="button" onClick={confirmNameAndSubmit} disabled={submitBusy}>
              Odevzdat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {resultUrl !== null && (
        <ShareModal
          url={resultUrl}
          onClose={() => setResultUrl(null)}
          title="Odkaz pro učitele"
          description="Zkopíruj tento odkaz a pošli ho učiteli – uvidí tvé odevzdané zapojení."
        />
      )}
    </div>
  );
}
