import { useState, useRef, useEffect } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  ImagePlus,
  Pencil,
  Library,
  Link,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { CircuitCanvas } from '../CircuitCanvas';
import { ComponentPalette, type Tool } from '../ComponentPalette';
import { getSupabase, getSupabaseConfigInfo, isSupabaseConfigured } from '@/lib/supabase';
import { CIRCUIT_ASSIGNMENTS_TABLE } from '@/lib/circuitTables';
import { assignmentPublicUrl } from '../../utils/appUrl';
import { TASK_LIBRARY, resolveLibraryImageSrc, resolveStudentLink } from './taskLibrary';
import {
  firstStepImage,
  instructionStepsToFallbackText,
  normalizeInstructionSteps,
} from '@/app/utils/instructionSteps';
import { toast } from 'sonner';

const MAX_IMAGE_BYTES = 1_500_000;

type StepDraft = { text: string; image: string | null };

async function svgToPngDataUrl(
  svg: SVGSVGElement,
  opts: { maxBytes: number; background?: string } = { maxBytes: MAX_IMAGE_BYTES },
): Promise<string> {
  const background = opts.background ?? '#ffffff';

  const vb = svg.viewBox?.baseVal;
  const vbX = vb?.x ?? 0;
  const vbY = vb?.y ?? 0;
  const vbW = vb?.width || 0;
  const vbH = vb?.height || 0;
  if (!vbW || !vbH) throw new Error('SVG nemá viewBox');

  const serializer = new XMLSerializer();
  const svgClone = svg.cloneNode(true) as SVGSVGElement;
  if (!svgClone.getAttribute('xmlns')) svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!svgClone.getAttribute('xmlns:xlink')) svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Drop invisible interaction layers (e.g. wide wire hit targets). Export used to recolor
  // stroke="transparent" to black → huge thick "wires" in the PNG.
  svgClone.querySelectorAll<SVGGeometryElement>('path, line, polyline, polygon, rect, circle, ellipse').forEach(el => {
    const stroke = el.getAttribute('stroke')?.trim().toLowerCase();
    if (stroke === 'transparent') el.remove();
  });

  // Sanitize for assignment images:
  // - remove/avoid connector dots / snap highlights
  // - force monochrome black strokes/fills
  const removeSelector = [
    // Interactive/assist highlights
    'circle[opacity]',
    'circle[fill="#3b82f6"]',
    'circle[fill="#dc2626"]',
    'circle[fill="#1f2937"]',
    // Any inline helpers in defs (keeps gradients/filters but we'll drop helper circles anyway)
  ].join(',');
  svgClone.querySelectorAll(removeSelector).forEach(el => {
    const tag = el.tagName.toLowerCase();
    if (tag !== 'circle') return;
    const rAttr = (el as SVGCircleElement).getAttribute('r');
    const r = rAttr ? Number(rAttr) : NaN;
    const opacity = (el as SVGCircleElement).getAttribute('opacity');
    const fill = (el as SVGCircleElement).getAttribute('fill');

    // Remove small snap/contact dots + probe helper circles (colored/transparent)
    const isSmallDot = Number.isFinite(r) && r <= 6;
    const isHelper =
      opacity !== null ||
      fill === '#3b82f6' ||
      fill === '#dc2626' ||
      fill === '#1f2937';
    if (isSmallDot || isHelper) el.remove();
  });

  // HTML inputy → do PNG jako <text> (hodnota z živého SVG; clone nemusí zkopírovat value z inputu)
  const liveLabelTexts = [...svg.querySelectorAll('foreignObject[data-export-exclude="true"]')].map(fo => {
    const inp = fo.querySelector('input');
    return inp ? (inp as HTMLInputElement).value : '';
  });
  let liveLabelIdx = 0;
  svgClone.querySelectorAll('foreignObject[data-export-exclude="true"]').forEach(fo => {
    const t = liveLabelTexts[liveLabelIdx++] ?? '';
    const x = Number(fo.getAttribute('x') ?? 0);
    const y = Number(fo.getAttribute('y') ?? 0);
    const w = Number(fo.getAttribute('width') ?? 80);
    const h = Number(fo.getAttribute('height') ?? 24);
    const parent = fo.parentNode;
    if (!parent) {
      fo.remove();
      return;
    }
    if (!t.trim()) {
      fo.remove();
      return;
    }
    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', String(x + w / 2));
    textEl.setAttribute('y', String(y + h * 0.72));
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('font-size', '11');
    textEl.setAttribute('font-weight', '600');
    textEl.setAttribute('fill', '#000000');
    textEl.textContent = t;
    parent.insertBefore(textEl, fo);
    fo.remove();
  });

  // Force monochrome black (avoid touching gradients/pattern fills / invisible strokes)
  svgClone.querySelectorAll<SVGElement>('*').forEach(el => {
    const stroke = el.getAttribute('stroke');
    const strokeLc = stroke?.trim().toLowerCase();
    if (
      stroke &&
      strokeLc !== 'none' &&
      strokeLc !== 'transparent' &&
      !stroke.startsWith('url(')
    ) {
      el.setAttribute('stroke', '#000000');
    }
    const fill = el.getAttribute('fill');
    const fillLc = fill?.trim().toLowerCase();
    if (
      fill &&
      fillLc !== 'none' &&
      fillLc !== 'transparent' &&
      !fill.startsWith('url(')
    ) {
      el.setAttribute('fill', '#000000');
    }
  });

  // Náhledová dlaždice pod kurzorem (modrá/oranžová) – zbytečně rozšíří bbox
  svgClone.querySelectorAll('rect').forEach(el => {
    const fill = el.getAttribute('fill');
    const o = Number.parseFloat(el.getAttribute('opacity') ?? '1');
    if (Number.isFinite(o) && o < 0.22 && (fill === '#3b82f6' || fill === '#f59e0b')) el.remove();
  });

  // Oříznutí na skutečný obsah (bez velkého prázdného plátna kolem viewBoxu)
  let cropX = vbX;
  let cropY = vbY;
  let cropW = vbW;
  let cropH = vbH;
  svgClone.style.position = 'absolute';
  svgClone.style.left = '-100000px';
  svgClone.style.top = '0';
  svgClone.style.visibility = 'hidden';
  svgClone.style.pointerEvents = 'none';
  document.body.appendChild(svgClone);
  try {
    const bb = svgClone.getBBox();
    if (bb.width > 2 && bb.height > 2) {
      const pad = Math.max(12, 0.03 * Math.max(bb.width, bb.height));
      const x0 = bb.x - pad;
      const y0 = bb.y - pad;
      const x1 = bb.x + bb.width + pad;
      const y1 = bb.y + bb.height + pad;
      const left = Math.max(vbX, x0);
      const top = Math.max(vbY, y0);
      const right = Math.min(vbX + vbW, x1);
      const bottom = Math.min(vbY + vbH, y1);
      const w = right - left;
      const h = bottom - top;
      if (w > 2 && h > 2) {
        cropX = left;
        cropY = top;
        cropW = w;
        cropH = h;
      }
    }
  } catch {
    // getBBox selže mimo layout – použij celý viewBox
  } finally {
    svgClone.remove();
  }

  svgClone.setAttribute('viewBox', `${cropX} ${cropY} ${cropW} ${cropH}`);
  svgClone.setAttribute('width', String(cropW));
  svgClone.setAttribute('height', String(cropH));
  svgClone.removeAttribute('style');

  const svgText = serializer.serializeToString(svgClone);
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  const renderAtScale = async (scale: number): Promise<Blob> => {
    const img = new Image();
    img.decoding = 'async';
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Nepodařilo se načíst SVG pro export'));
    });
    img.src = svgUrl;
    await loaded;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(cropW * scale));
    canvas.height = Math.max(1, Math.round(cropH * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context není dostupný');

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('Export do PNG selhal'))),
        'image/png',
      );
    });
    return blob;
  };

  try {
    // Try progressively smaller exports to fit size limit.
    const scales = [2, 1.6, 1.3, 1.0, 0.85, 0.7, 0.55];
    let lastBlob: Blob | null = null;
    for (const s of scales) {
      const blob = await renderAtScale(s);
      lastBlob = blob;
      if (blob.size <= opts.maxBytes) {
        return await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(new Error('Nepodařilo se načíst PNG'));
          r.readAsDataURL(blob);
        });
      }
    }

    throw new Error(
      `Obrázek je moc velký (${Math.round((lastBlob?.size ?? 0) / 1024)} kB). Zkus obvod zjednodušit nebo zoom zmenšit.`,
    );
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

/** Z pole URL nebo samotného UUID vytáhne ID zadání (circuit_assignments.id). */
function parseAssignmentIdFromInput(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const uuid =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
  const only = s.match(uuid);
  if (only) return only[1].toLowerCase();
  const inPath = s.match(/\/ukol\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (inPath) return inPath[1].toLowerCase();
  const anywhere = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return anywhere ? anywhere[0].toLowerCase() : null;
}

function formatDbError(e: unknown): string {
  if (!e || typeof e !== "object") return "Neznámá chyba";
  const o = e as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
    statusCode?: string;
  };
  const parts = [o.message, o.details, o.hint, o.code ? `(${o.code})` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : JSON.stringify(e).slice(0, 200);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TasksSheet({ open, onOpenChange }: Props) {
  const createdLinkInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState<StepDraft[]>([{ text: '', image: null }]);
  const [dragActiveStep, setDragActiveStep] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [editAssignmentUrl, setEditAssignmentUrl] = useState('');
  const [editByUrlOpen, setEditByUrlOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const [drawStepIndex, setDrawStepIndex] = useState<number | null>(null);
  const drawSvgRef = useRef<SVGSVGElement | null>(null);
  const [drawTool, setDrawTool] = useState<Tool>('select');
  const [drawZoom, setDrawZoom] = useState(2);
  const [drawClearTrigger, setDrawClearTrigger] = useState(0);
  /** Přepsané textové štítky hodnot u baterií/rezistorů ve schématu (editor kreslení). */
  const [drawSchemaLabels, setDrawSchemaLabels] = useState<Record<string, string>>({});
  /** title + instruction_image z DB podle UUID zadani (pro knihovnu) */
  const [libraryDbMeta, setLibraryDbMeta] = useState<
    Record<string, { instruction_image: string | null; title: string | null }>
  >({});
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setLibraryOpen(true);
      setEditAssignmentUrl('');
      setEditByUrlOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !libraryOpen || !isSupabaseConfigured) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const ids = [
      ...new Set(
        TASK_LIBRARY.map(e => e.assignmentId?.trim()).filter((v): v is string => Boolean(v)),
      ),
    ];
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from(CIRCUIT_ASSIGNMENTS_TABLE)
          .select('id, instruction_image, title')
          .in('id', ids);
        if (cancelled || error || !data) return;
        const next: Record<string, { instruction_image: string | null; title: string | null }> = {};
        for (const row of data as { id: string; instruction_image: string | null; title: string | null }[]) {
          next[row.id] = { instruction_image: row.instruction_image, title: row.title };
        }
        setLibraryDbMeta(next);
      } catch (e) {
        if (!cancelled) {
          console.error('Načtení knihovny (Supabase):', e);
          toast.error('Nepodařilo se načíst knihovnu úkolů (Supabase).');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, libraryOpen]);

  useEffect(() => {
    if (!createdUrl) return;
    setLinkCopied(false);
    const t = window.setTimeout(() => createdLinkInputRef.current?.select(), 0);
    return () => window.clearTimeout(t);
  }, [createdUrl]);

  useEffect(() => {
    if (drawOpen) setDrawSchemaLabels({});
  }, [drawOpen]);

  const resetForm = () => {
    setTitle('');
    setSteps([{ text: '', image: null }]);
    setDragActiveStep(null);
  };

  const openDrawForStep = (index: number) => {
    setDrawStepIndex(index);
    setDrawTool('select');
    setDrawZoom(2);
    setDrawClearTrigger(t => t + 1);
    setDrawOpen(true);
  };

  const insertDrawnCircuitToStep = async () => {
    const idx = drawStepIndex;
    const svg = drawSvgRef.current;
    if (idx == null || !svg) return;
    try {
      const dataUrl = await svgToPngDataUrl(svg, { maxBytes: MAX_IMAGE_BYTES, background: '#ffffff' });
      setStepImageAt(idx, dataUrl);
      setDrawOpen(false);
      toast.success('Obvod vložen jako obrázek.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nepodařilo se vložit obvod jako obrázek.');
    }
  };

  const loadLibraryAssignmentIntoDraft = async (assignmentId: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      toast.error('Supabase klient není k dispozici.');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from(CIRCUIT_ASSIGNMENTS_TABLE)
        .select('id, title, instruction_text, instruction_steps')
        .eq('id', assignmentId)
        .maybeSingle();
      if (error || !data) {
        throw error ?? new Error('Zadání se nepodařilo načíst.');
      }

      const normalized = normalizeInstructionSteps((data as any).instruction_steps);
      const nextSteps: StepDraft[] =
        normalized.length > 0
          ? normalized.map(s => ({ text: s.text, image: s.image }))
          : [
              {
                text: String((data as any).instruction_text ?? '').trim(),
                image: null,
              },
            ];

      setTitle(String((data as any).title ?? '').trim());
      setSteps(nextSteps.length > 0 ? nextSteps : [{ text: '', image: null }]);
      setDragActiveStep(null);
      setCreatedUrl(null);
      setLinkCopied(false);
      setLibraryOpen(false);
      setEditAssignmentUrl('');
      setEditByUrlOpen(false);
      toast.success('Zadání načteno – uprav a ulož jako nové.');
    } catch (e) {
      console.error('Načtení zadání pro úpravu (Supabase):', e);
      toast.error('Nepodařilo se načíst zadání pro úpravu.');
    } finally {
      setBusy(false);
    }
  };

  const setStepTextAt = (index: number, value: string) => {
    setSteps(prev => prev.map((s, i) => (i === index ? { ...s, text: value } : s)));
  };

  const setStepImageAt = (index: number, dataUrl: string | null) => {
    setSteps(prev => prev.map((s, i) => (i === index ? { ...s, image: dataUrl } : s)));
  };

  const addStep = () => setSteps(prev => [...prev, { text: '', image: null }]);

  const removeStep = (index: number) => {
    setSteps(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
    setDragActiveStep(d => {
      if (d == null) return null;
      if (d === index) return null;
      if (d > index) return d - 1;
      return d;
    });
  };

  const onPickStepImage = (index: number, file: File | undefined) => {
    if (!file) {
      setStepImageAt(index, null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Vyber obrázek (JPG, PNG, …)');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Obrázek je moc velký (max. cca 1,5 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setStepImageAt(index, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleLoadAssignmentFromUrl = async () => {
    const id = parseAssignmentIdFromInput(editAssignmentUrl);
    if (!id) {
      toast.error('Vlož platnou adresu zadání nebo UUID.');
      return;
    }
    await loadLibraryAssignmentIntoDraft(id);
  };

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} zkopírováno`);
    } catch {
      toast.error('Kopírování se nepovedlo');
    }
  };

  const handleCreate = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      toast.error('Supabase klient není k dispozici.');
      return;
    }
    const cleaned = steps
      .map(s => ({ text: s.text.trim(), image: s.image }))
      .filter(s => s.text.length > 0);
    if (cleaned.length === 0) {
      toast.error('Vyplň aspoň jeden krok zadání.');
      return;
    }
    setBusy(true);
    try {
      const cleanedTitle = title.trim();
      const payload = {
        title: cleanedTitle,
        instruction_text: instructionStepsToFallbackText(cleaned.map(s => s.text)),
        instruction_steps: cleaned.map(s => (s.image ? { text: s.text, image: s.image } : { text: s.text })),
        instruction_image: firstStepImage(cleaned) ?? null,
      };
      const { data, error } = await supabase.from(CIRCUIT_ASSIGNMENTS_TABLE).insert(payload).select("id");

      if (error) throw error;
      const row = data?.[0];
      if (!row?.id) {
        throw new Error(
          "Záznam se nevrátil z databáze (zkontroluj RLS: INSERT i SELECT pro circuit_assignments).",
        );
      }

      const url = assignmentPublicUrl(row.id);
      setCreatedUrl(url);
      resetForm();
      toast.success('Zadání je v databázi – zkopíruj odkaz pro studenty.');
    } catch (e) {
      console.error("Uložení zadání (Supabase):", e);
      const config = getSupabaseConfigInfo();
      const isFetchFailure =
        e instanceof TypeError && /fetch/i.test(e.message || '') ||
        (typeof e === 'object' && e !== null && 'message' in e && String((e as any).message).includes('Failed to fetch'));
      const detail = formatDbError(e);
      toast.error(
        isFetchFailure
          ? `Supabase je nedostupný (Failed to fetch). Zkontroluj připojení, DNS / blokátory a konfiguraci. URL: ${config.url ?? '—'}`
          : detail.length > 0
            ? detail
            : "Nepodařilo se uložit zadání. V Supabase spusť supabase/schema.sql (circuit_assignments, circuit_submissions).",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={v => {
          if (!v) {
            setLibraryOpen(true);
            setEditAssignmentUrl('');
            setEditByUrlOpen(false);
            setLibraryDbMeta({});
            setCreatedUrl(null);
            setLinkCopied(false);
          }
          onOpenChange(v);
        }}
      >
        <SheetContent
          side="right"
          className="inset-0 left-0 right-0 flex h-[100dvh] w-screen !max-w-none flex-col gap-0 overflow-hidden border-l-0 p-0"
        >
          <div
            className={[
              'mx-auto flex h-full w-full flex-col overflow-hidden',
              'max-w-[min(100vw-24px,1200px)]',
            ].join(' ')}
          >
            {!libraryOpen ? (
              <>
                <SheetHeader className="w-full px-4 pt-4 pr-12">
                  <SheetTitle>Úkoly</SheetTitle>
                  <SheetDescription>
                    Ke každému kroku můžeš přidat vlastní obrázek. Odkaz pošli studentům; jejich odevzdání uvidíš na odkazu
                    z jejich odpovědi.
                  </SheetDescription>
                </SheetHeader>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {createdUrl ? (
                    <div className="mb-1 flex w-full flex-col gap-3 rounded-2xl border border-zinc-200/90 bg-[#f5f4f8] p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2 text-[#1e1b4b]">
                          <Link className="size-4 shrink-0" aria-hidden />
                          <span className="text-[15px] font-bold leading-tight">Odkaz na zadání</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCreatedUrl(null);
                            setLinkCopied(false);
                          }}
                          className="flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-200/80 hover:text-zinc-600"
                          title="Skrýt odkaz"
                          aria-label="Skrýt odkaz"
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      </div>
                      <p className="m-0 text-[13px] leading-snug text-zinc-600">
                        Zkopíruj odkaz a pošli ho studentům. Po vyplnění jména uvidí zadání vpravo a mohou tvořit obvod.
                      </p>
                      <div className="flex min-w-0 items-center gap-2">
                        <input
                          ref={createdLinkInputRef}
                          readOnly
                          value={createdUrl}
                          onClick={() => createdLinkInputRef.current?.select()}
                          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-700 outline-none ring-indigo-500/0 transition-shadow focus-visible:ring-2"
                          style={{ fontFamily: 'ui-monospace, monospace' }}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(createdUrl);
                            } catch {
                              createdLinkInputRef.current?.select();
                              document.execCommand('copy');
                            }
                            setLinkCopied(true);
                            toast.success('Odkaz zkopírován');
                            window.setTimeout(() => setLinkCopied(false), 2000);
                          }}
                          className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-all active:scale-[0.98]"
                          style={{ background: linkCopied ? '#22c55e' : '#1e1b4b' }}
                        >
                          {linkCopied ? (
                            <>
                              <Check className="size-3.5" aria-hidden />
                              Zkopírováno
                            </>
                          ) : (
                            <>
                              <Copy className="size-3.5" aria-hidden />
                              Kopírovat
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex w-full flex-col gap-4 px-4 pb-3">

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-base" htmlFor="task-title">
                      Název zadání (volitelné)
                    </Label>
                    <input
                      id="task-title"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Např. Ampérmetr – základní zapojení"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none ring-indigo-500/0 transition-shadow focus-visible:ring-2 focus-visible:ring-indigo-400"
                    />
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <Label className="text-base">Kroky zadání</Label>
                    <button
                      type="button"
                      onClick={addStep}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50"
                    >
                      <Plus className="size-3.5" aria-hidden />
                      Přidat krok
                    </button>
                  </div>
                  <p className="m-0 text-xs text-zinc-500 leading-snug">
                    Každý krok se studentům zobrazí jako očíslovaný bod; obrázek u kroku je volitelný.
                  </p>
                  <ul className="m-0 grid list-none grid-cols-1 justify-items-center gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {steps.map((step, index) => {
                      const stepDrag = dragActiveStep === index;
                      return (
                        <li key={index} className="w-full max-w-[440px] rounded-xl border border-zinc-200/90 bg-zinc-50/40 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                              Krok {index + 1}
                            </span>
                            {steps.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeStep(index)}
                                className="flex size-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                title="Odebrat krok"
                                aria-label={`Odebrat krok ${index + 1}`}
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </button>
                            ) : null}
                          </div>
                          <Textarea
                            id={index === 0 ? 'task-step-0' : undefined}
                            value={step.text}
                            onChange={e => setStepTextAt(index, e.target.value)}
                            placeholder="Např. Sestroj obvod se dvěma žárovkami …"
                            rows={4}
                            className="resize-y min-h-[88px] bg-white"
                          />
                          <div className="mt-3 space-y-2">
                            <Label htmlFor={`task-step-img-${index}`} className="text-xs text-zinc-600">
                              Obrázek ke kroku (volitelné)
                            </Label>
                            <input
                              id={`task-step-img-${index}`}
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={e => {
                                onPickStepImage(index, e.target.files?.[0]);
                                e.target.value = '';
                              }}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => document.getElementById(`task-step-img-${index}`)?.click()}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    document.getElementById(`task-step-img-${index}`)?.click();
                                  }
                                }}
                                onDragEnter={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDragActiveStep(index);
                                }}
                                onDragOver={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onDragLeave={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                    setDragActiveStep(d => (d === index ? null : d));
                                  }
                                }}
                                onDrop={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDragActiveStep(null);
                                  onPickStepImage(index, e.dataTransfer.files?.[0]);
                                }}
                                className={[
                                  'flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-4 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1',
                                  stepDrag
                                    ? 'border-indigo-400 bg-indigo-50/80 text-indigo-900'
                                    : 'border-zinc-300 bg-white/80 text-zinc-600 hover:border-zinc-400 hover:bg-white',
                                ].join(' ')}
                              >
                                <ImagePlus
                                  className={`size-7 stroke-[1.5] ${stepDrag ? 'text-indigo-500' : 'text-zinc-400'}`}
                                  aria-hidden
                                />
                                <div className="text-xs font-medium text-zinc-700">Přidat obrázek</div>
                                <div className="text-[11px] text-zinc-500">max. 1,5&nbsp;MB</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => openDrawForStep(index)}
                                className="flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white/90 px-3 py-4 text-center text-zinc-700 shadow-sm transition-colors hover:bg-white hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1"
                              >
                                <Pencil className="size-7 stroke-[1.5] text-zinc-500" aria-hidden />
                                <div className="text-xs font-medium text-zinc-800">Nakreslit obvod</div>
                                <div className="text-[11px] text-zinc-500">vloží jako obrázek</div>
                              </button>
                            </div>
                            {step.image ? (
                              <div className="relative inline-block max-w-full">
                                <img
                                  src={step.image}
                                  alt={`Náhled kroku ${index + 1}`}
                                  className="max-h-40 w-full rounded-lg border border-zinc-200 object-contain"
                                />
                                <button
                                  type="button"
                                  onClick={() => setStepImageAt(index, null)}
                                  className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-zinc-900/75 text-white shadow-md transition-colors hover:bg-zinc-900"
                                  title="Odebrat obrázek"
                                >
                                  <X size={16} aria-hidden />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <Button
                  type="button"
                  onClick={handleCreate}
                  disabled={busy || !steps.some(s => s.text.trim())}
                  className="w-full"
                >
                  {busy ? 'Ukládám…' : 'Publikovat úkol'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setCreatedUrl(null);
                    setLinkCopied(false);
                    resetForm();
                    toast.success('Zadání vymazáno.');
                  }}
                  className="w-full"
                >
                  Nový úkol
                </Button>
                  </div>
                </div>

                <div className="mx-auto w-full max-w-[440px] shrink-0 mt-auto px-4 pb-6 pt-1">
                  <button
                    type="button"
                    onClick={() => setLibraryOpen(true)}
                    aria-expanded={false}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/90 px-4 py-3 text-sm font-semibold text-zinc-800 shadow-sm transition-colors hover:bg-zinc-100"
                  >
                    <Library className="size-4 text-zinc-600 shrink-0" aria-hidden />
                    Knihovna úkolů
                    <ChevronDown className="size-4 text-zinc-500 shrink-0 opacity-80" aria-hidden />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
              <SheetHeader className="border-b border-zinc-100 px-4 pt-4 pb-3 pr-12">
                <div className="flex items-center gap-2">
                  <Library className="size-5 text-zinc-600 shrink-0" aria-hidden />
                  <SheetTitle className="text-left">Knihovna úkolů</SheetTitle>
                </div>
                <SheetDescription className="text-left">
                  Vyber přednastavené zadání, vytvoř nové nebo načti existující podle odkazu.
                </SheetDescription>
              </SheetHeader>

              <div className="shrink-0 space-y-3 border-b border-zinc-100 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="w-full sm:flex-1"
                    onClick={() => {
                      setEditByUrlOpen(false);
                      setEditAssignmentUrl('');
                      setLibraryOpen(false);
                    }}
                  >
                    Vytvořit úkol
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:flex-1"
                    onClick={() => setEditByUrlOpen(v => !v)}
                    aria-expanded={editByUrlOpen}
                  >
                    Editovat úkol
                  </Button>
                </div>
                {editByUrlOpen ? (
                  <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
                    <Label htmlFor="edit-assignment-url" className="text-xs text-zinc-600">
                      Odkaz nebo ID existujícího zadání
                    </Label>
                    <input
                      id="edit-assignment-url"
                      value={editAssignmentUrl}
                      onChange={e => setEditAssignmentUrl(e.target.value)}
                      placeholder="https://…/ukol/… nebo vlož UUID"
                      disabled={busy}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none ring-indigo-500/0 focus-visible:ring-2 focus-visible:ring-indigo-400"
                      style={{ fontFamily: 'ui-monospace, monospace' }}
                    />
                    <Button
                      type="button"
                      className="w-full"
                      disabled={busy || !editAssignmentUrl.trim()}
                      onClick={() => void handleLoadAssignmentFromUrl()}
                    >
                      {busy ? 'Načítám…' : 'Načíst a editovat'}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {TASK_LIBRARY.length === 0 ? (
                  <p className="text-sm text-zinc-500 leading-relaxed">
                    Zatím žádné položky. Uprav{' '}
                    <code className="rounded bg-zinc-100 px-1 text-xs">taskLibrary.ts</code>.
                  </p>
                ) : (
                  <ul className="grid grid-cols-1 justify-items-center gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {TASK_LIBRARY.map((entry, index) => {
                      const link = resolveStudentLink(entry);
                      const id = entry.assignmentId?.trim();
                      const fromDb = id ? libraryDbMeta[id] : undefined;
                      const displayTitle =
                        fromDb?.title && fromDb.title.trim() ? fromDb.title.trim() : entry.title;
                      const imgSrc =
                        resolveLibraryImageSrc(entry.imageUrl) ??
                        (fromDb?.instruction_image && fromDb.instruction_image.trim()
                          ? fromDb.instruction_image
                          : null);
                      return (
                        <li
                          key={entry.key}
                          className="w-full max-w-[440px] rounded-xl border border-zinc-200 bg-white px-3 py-3 shadow-sm"
                        >
                          <div className="flex items-stretch gap-3">
                            <div className="min-w-0 flex-1 flex flex-col justify-between gap-3">
                              <div className="text-[1.1375rem] font-semibold text-zinc-900 leading-snug">
                                <span className="mr-2 text-sm font-semibold tabular-nums text-zinc-500">
                                  {index + 1}.
                                </span>
                                {displayTitle}
                              </div>
                              {link ? (
                                <div className="flex flex-col items-start gap-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <a
                                      href={link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50"
                                    >
                                      <ExternalLink className="size-3.5 shrink-0 opacity-80" aria-hidden />
                                      Otevřít
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => void copyText('Odkaz pro zadání', link)}
                                      className="inline-flex items-center justify-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100"
                                    >
                                      <Copy className="size-3.5 shrink-0 opacity-70" aria-hidden />
                                      Odkaz pro zadání
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!id || busy}
                                      onClick={() => (id ? void loadLibraryAssignmentIntoDraft(id) : undefined)}
                                      className="inline-flex items-center justify-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                                      title={!id ? 'Toto zadání nemá assignmentId' : 'Upravit toto zadání'}
                                    >
                                      Upravit
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            {imgSrc ? (
                              <div className="shrink-0 w-[min(48.96vw,11.475rem)] h-[min(48.96vw,11.475rem)] overflow-hidden rounded-lg bg-white">
                                <img
                                  src={imgSrc}
                                  alt=""
                                  className="h-full w-full object-contain object-center"
                                />
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={drawOpen} onOpenChange={setDrawOpen}>
        <DialogContent
          className="fixed !inset-0 !left-0 !top-0 z-50 flex h-[100dvh] max-h-[100dvh] w-screen min-h-0 min-w-0 max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none sm:max-w-none [&>button.absolute]:hidden"
        >
          <div className="flex h-full w-full flex-col bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <DialogTitle className="m-0 flex items-center gap-2 text-base font-semibold text-zinc-900">
                <Pencil className="size-4 text-zinc-600" aria-hidden />
                Nakreslit elektrický obvod (schéma)
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDrawClearTrigger(t => t + 1);
                    setDrawSchemaLabels({});
                  }}
                  className="gap-2"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Vymazat
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDrawOpen(false)}
                >
                  Zrušit
                </Button>
                <Button
                  type="button"
                  onClick={() => void insertDrawnCircuitToStep()}
                >
                  Vložit jako obrázek
                </Button>
              </div>
            </div>

            <div className="relative flex-1 overflow-hidden">
              <CircuitCanvas
                tool={drawTool}
                viewMode="schema"
                clearTrigger={drawClearTrigger}
                zoom={drawZoom}
                setTool={setDrawTool}
                setZoom={setDrawZoom}
                isViewOnly={false}
                svgElementRef={drawSvgRef}
                editableSchemaValueLabels
                schemaValueLabels={drawSchemaLabels}
                onSchemaValueLabelChange={(id, value) =>
                  setDrawSchemaLabels(prev => ({ ...prev, [id]: value }))
                }
              />

              <div className="absolute left-3 top-1/2 z-20 -translate-y-1/2">
                <ComponentPalette
                  tool={drawTool}
                  onToolChange={setDrawTool}
                  onClearAll={() => {
                    setDrawClearTrigger(t => t + 1);
                    setDrawSchemaLabels({});
                  }}
                />
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-2">
                <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-3 py-2 shadow-sm">
                  <span className="text-xs font-semibold text-zinc-700">Zoom</span>
                  <button
                    type="button"
                    onClick={() => setDrawZoom(z => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    −
                  </button>
                  <span className="min-w-[52px] text-center text-xs font-semibold tabular-nums text-zinc-700">
                    {Math.round(drawZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrawZoom(z => Math.min(6, Math.round((z + 0.25) * 100) / 100))}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
