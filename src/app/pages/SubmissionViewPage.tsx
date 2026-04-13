import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router';
import { TopBar } from '../components/TopBar';
import type { ViewMode } from '../components/ComponentSvg';
import { ComponentPalette, type Tool } from '../components/ComponentPalette';
import { CircuitCanvas } from '../components/CircuitCanvas';
import { Toaster } from '../components/ui/sonner';
import { getSupabase } from '@/lib/supabase';
import { CIRCUIT_ASSIGNMENTS_TABLE, CIRCUIT_SUBMISSIONS_TABLE } from '@/lib/circuitTables';
import { decodeCircuit } from '../utils/circuitUrl';
import { useIsTouch, useToolbarScale } from '../hooks/editorChrome';

type SubmissionRow = {
  id: string;
  student_name: string;
  circuit_encoded: string;
  assignment_id: string;
};

type AssignmentRow = {
  instruction_text: string;
  instruction_image: string | null;
};

export default function SubmissionViewPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>('realistic');
  const [zoom, setZoom] = useState(2);
  const [tool, setTool] = useState<Tool>('select');
  const isTouch = useIsTouch();
  const toolbarScale = useToolbarScale();

  const setViewTool = useCallback((t: Tool) => {
    if (t === 'select' || t === 'pan') setTool(t);
  }, []);

  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [submission, setSubmission] = useState<SubmissionRow | null>(null);
  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);

  useEffect(() => {
    if (!submissionId) {
      setLoadState('error');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setLoadState('error');
      return;
    }

    let cancelled = false;
    (async () => {
      const { data: sub, error: e1 } = await supabase
        .from(CIRCUIT_SUBMISSIONS_TABLE)
        .select('*')
        .eq('id', submissionId)
        .maybeSingle();
      if (cancelled) return;
      if (e1 || !sub) {
        setLoadState('error');
        return;
      }
      setSubmission(sub as SubmissionRow);

      const { data: asg } = await supabase
        .from(CIRCUIT_ASSIGNMENTS_TABLE)
        .select('instruction_text, instruction_image')
        .eq('id', (sub as SubmissionRow).assignment_id)
        .maybeSingle();

      if (!cancelled && asg) setAssignment(asg as AssignmentRow);
      setLoadState('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  const initialState = useMemo(() => {
    if (!submission?.circuit_encoded) return undefined;
    return decodeCircuit(submission.circuit_encoded);
  }, [submission]);

  if (!submissionId) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-600">Neplatný odkaz.</div>;
  }

  if (loadState === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500">Načítám odevzdání…</div>;
  }

  if (loadState === 'error' || !submission || !initialState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 p-6 text-center text-zinc-600">
        <p>Odevzdání se nepodařilo načíst.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      <Toaster position="bottom-center" />

      <div className="flex-1 relative min-w-0 overflow-hidden">
        <CircuitCanvas
          tool={tool}
          viewMode={viewMode}
          clearTrigger={0}
          zoom={zoom}
          setTool={setViewTool}
          setZoom={setZoom}
          isViewOnly
          initialState={initialState}
          isTouch={isTouch}
        />

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
            navigationOnly
            tool={tool}
            onToolChange={setTool}
            onClearAll={() => {}}
          />
        </div>

        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          <TopBar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            zoom={zoom}
            onZoomChange={setZoom}
            isViewOnly
          />
        </div>
      </div>

      <aside className="flex w-[min(100vw,288px)] min-w-0 shrink-0 flex-col border-l border-zinc-200 bg-zinc-50/90">
        <div className="shrink-0 border-b border-zinc-200/80 px-4 py-3">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Odevzdání</div>
          <p className="mt-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Student:</span> {submission.student_name}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {assignment && (
            <>
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Zadání</div>
              <p className="text-sm text-zinc-800 whitespace-pre-wrap">{assignment.instruction_text || '—'}</p>
              {assignment.instruction_image ? (
                <img
                  src={assignment.instruction_image}
                  alt="Zadání"
                  className="rounded-lg border border-zinc-200 w-full object-contain max-h-[40vh]"
                />
              ) : null}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
