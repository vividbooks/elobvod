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
          className="flex shrink-0 flex-col items-center justify-center gap-1.5 border-l border-[#4a5163] bg-[#565e75] px-2 py-4 text-white transition-colors hover:bg-[#4f566b]"
          title="Zobrazit panel se zadáním"
          aria-label="Zobrazit panel se zadáním"
          aria-expanded={false}
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-center leading-tight text-[#c8cedf] [writing-mode:vertical-rl]">
            Zadání
          </span>
        </button>
      ) : (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Změnit šířku panelu zadání"
            className="z-30 flex w-2.5 shrink-0 cursor-col-resize select-none justify-center border-l border-[#3d4456] bg-[#4a5163] hover:bg-[#525a70]"
            onPointerDown={onAsideResizePointerDown}
            onPointerMove={onAsideResizePointerMove}
            onPointerUp={onAsideResizePointerUp}
            onPointerCancel={onAsideResizePointerUp}
          />

          <aside
            className="flex min-w-0 shrink-0 flex-col bg-[#565e75] text-white"
            style={{ width: asideWidth }}
            aria-expanded={true}
          >
            <header className="shrink-0 border-b border-[#4a5163] bg-[#565e75]">
              <div className="flex items-center gap-2 px-4 pt-[15px] pb-2">
                <div
                  className="flex h-11 w-6 shrink-0 cursor-col-resize select-none items-center justify-center rounded-full border border-sky-400/90 bg-sky-500 transition-[transform,background-color,border-color] hover:border-sky-300 hover:bg-sky-600 active:scale-95"
                  onPointerDown={onAsideResizePointerDown}
                  onPointerMove={onAsideResizePointerMove}
                  onPointerUp={onAsideResizePointerUp}
                  onPointerCancel={onAsideResizePointerUp}
                  title="Změnit šířku panelu"
                  aria-hidden
                >
                  <GripVertical className="size-3 text-white/95" strokeWidth={2} />
                </div>
                <button
                  type="button"
                  onClick={() => setAsideCollapsed(true)}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/20 bg-[#4f566b] px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:border-white/30 hover:bg-[#5c647a]"
                  title="Schovat panel (zůstane úzký proužek vpravo)"
                  aria-label="Skrýt panel se zadáním"
                >
                  Skrýt
                  <ChevronRight className="size-4 shrink-0 opacity-90" aria-hidden />
                </button>
              </div>
              <div className="min-w-0 space-y-1 px-4 pb-3 pt-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b0b8d4]">Zadání</p>
                {assignment.title?.trim() ? (
                  <h1 className="text-[15px] font-semibold leading-snug tracking-tight text-white">
                    {assignment.title.trim()}
                  </h1>
                ) : (
                  <h1 className="text-[15px] font-semibold leading-snug text-white">Úkol</h1>
                )}
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
              {instructionView.kind === 'steps' ? (
                <div className="flex flex-col gap-3">
                  {stepsCount > 1 ? (
                    <div className="rounded-xl border border-white/12 bg-[#4f566b] p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center rounded-full bg-[#fbc02d] px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-900">
                          Krok {Math.min(stepIndex + 1, stepsCount)} z {stepsCount}
                        </span>
                        <div className="flex items-center rounded-lg border border-white/15 bg-[#3d4456] p-0.5">
                          <button
                            type="button"
                            onClick={() => setStepIndex(i => Math.max(0, i - 1))}
                            disabled={stepIndex <= 0}
                            className="flex size-8 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                            aria-label="Předchozí krok"
                            title="Předchozí"
                          >
                            <ChevronLeft className="size-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => setStepIndex(i => Math.min(stepsCount - 1, i + 1))}
                            disabled={stepIndex >= stepsCount - 1}
                            className="flex size-8 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                            aria-label="Další krok"
                            title="Další"
                          >
                            <ChevronRight className="size-4" aria-hidden />
                          </button>
                        </div>
                      </div>
                      <div
                        className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15"
                        role="progressbar"
                        aria-valuemin={1}
                        aria-valuemax={stepsCount}
                        aria-valuenow={Math.min(stepIndex + 1, stepsCount)}
                        aria-label="Postup v zadání"
                      >
                        <div
                          className="h-full rounded-full bg-[#fbc02d] transition-[width] duration-200 ease-out"
                          style={{ width: `${((Math.min(stepIndex + 1, stepsCount)) / stepsCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {activeStep ? (
                    <article className="rounded-xl border border-white/12 bg-[#4f566b] p-4 shadow-sm">
                      <div className="text-[15px] leading-relaxed text-white/95 whitespace-pre-wrap [font-family:'Fenomen_Sans',system-ui,sans-serif]">
                        {activeStep.text}
                      </div>
                      {activeStep.image ? (
                        <img
                          src={activeStep.image}
                          alt=""
                          className="mt-4 w-full max-w-full rounded-lg border border-white/15 object-contain max-h-[min(40vh,18rem)]"
                        />
                      ) : null}
                    </article>
                  ) : (
                    <p className="rounded-xl border border-dashed border-white/25 bg-[#4f566b]/50 px-4 py-6 text-center text-sm text-[#c8cedf]">
                      —
                    </p>
                  )}
                </div>
              ) : (
                <article className="rounded-xl border border-white/12 bg-[#4f566b] p-4 shadow-sm">
                  <div className="text-[15px] leading-relaxed text-white/95 whitespace-pre-wrap [font-family:'Fenomen_Sans',system-ui,sans-serif]">
                    {instructionView.text || '—'}
                  </div>
                  {assignment.instruction_image ? (
                    <img
                      src={assignment.instruction_image}
                      alt="Ilustrace ke zadání"
                      className="mt-4 w-full max-w-full rounded-lg border border-white/15 object-contain max-h-[min(40vh,18rem)]"
                    />
                  ) : null}
                </article>
              )}

              <section className="space-y-2 rounded-xl border border-dashed border-white/20 bg-[#4f566b] p-3 shadow-sm">
                <Label htmlFor="student-teacher-note" className="text-xs font-medium text-[#c8cedf]">
                  Poznámka pro učitele{' '}
                  <span className="font-normal text-[#9ca3bc]">(volitelné)</span>
                </Label>
                <textarea
                  id="student-teacher-note"
                  value={studentNote}
                  onChange={e => {
                    const v = e.target.value;
                    setStudentNote(v);
                    if (assignmentId) sessionStorage.setItem(noteStorageKey(assignmentId), v);
                  }}
                  placeholder="Např. co bylo nejasné, co jsi zkoušel(a)…"
                  rows={3}
                  className="w-full resize-y rounded-lg border border-white/15 bg-[#3d4456] px-3 py-2 text-sm text-white outline-none transition-shadow placeholder:text-[#9ca3bc] focus-visible:border-[#fbc02d]/50 focus-visible:ring-2 focus-visible:ring-[#fbc02d]/25"
                />
              </section>

              <div className="rounded-lg border border-white/10 bg-[#4f566b] px-3 py-2 text-xs text-[#c8cedf]">
                {studentName ? (
                  <span>
                    <span className="font-medium text-white">Jméno:</span> {studentName}
                  </span>
                ) : (
                  <span className="text-[#9ca3bc]">Jméno se doplní při odevzdání.</span>
                )}
              </div>
            </div>

            <footer className="shrink-0 border-t border-[#4a5163] bg-[#4a5163] p-4">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitBusy}
                className="w-full rounded-xl bg-[#fbc02d] px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-[#f9a825] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitBusy ? 'Odevzdávám…' : 'Odevzdat cvičení'}
              </button>
            </footer>
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
