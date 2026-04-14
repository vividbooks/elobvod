import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  ImagePlus,
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
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { CIRCUIT_ASSIGNMENTS_TABLE } from '@/lib/circuitTables';
import { assignmentPublicUrl } from '../../utils/appUrl';
import { TASK_LIBRARY, resolveLibraryImageSrc, resolveStudentLink } from './taskLibrary';
import {
  firstStepImage,
  instructionStepsToFallbackText,
} from '@/app/utils/instructionSteps';
import { toast } from 'sonner';

const MAX_IMAGE_BYTES = 1_500_000;

type StepDraft = { text: string; image: string | null };

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
  const [steps, setSteps] = useState<StepDraft[]>([{ text: '', image: null }]);
  const [dragActiveStep, setDragActiveStep] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  /** instruction_image z DB podle UUID zadani (pro nahled v knihovne) */
  const [libraryDbImages, setLibraryDbImages] = useState<Record<string, string | null>>({});
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!libraryOpen || !isSupabaseConfigured) return;
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
      const { data, error } = await supabase
        .from(CIRCUIT_ASSIGNMENTS_TABLE)
        .select('id, instruction_image')
        .in('id', ids);
      if (cancelled || error || !data) return;
      const next: Record<string, string | null> = {};
      for (const row of data as { id: string; instruction_image: string | null }[]) {
        next[row.id] = row.instruction_image;
      }
      setLibraryDbImages(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [libraryOpen]);

  useEffect(() => {
    if (!createdUrl) return;
    setLinkCopied(false);
    const t = window.setTimeout(() => createdLinkInputRef.current?.select(), 0);
    return () => window.clearTimeout(t);
  }, [createdUrl]);

  const resetForm = () => {
    setSteps([{ text: '', image: null }]);
    setDragActiveStep(null);
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
      const payload = {
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
      const detail = formatDbError(e);
      toast.error(
        detail.length > 0
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
            setLibraryOpen(false);
            setLibraryDbImages({});
            setCreatedUrl(null);
            setLinkCopied(false);
          }
          onOpenChange(v);
        }}
      >
        <SheetContent
          side="right"
          className="flex w-[min(100vw-16px,440px)] !max-w-[min(100vw-16px,440px)] flex-col gap-0 overflow-y-auto p-0"
        >
          {!libraryOpen ? (
            <>
              <SheetHeader className="px-4 pt-4 pr-12">
                <SheetTitle>Úkoly</SheetTitle>
                <SheetDescription>
                  Ke každému kroku můžeš přidat vlastní obrázek. Odkaz pošli studentům; jejich odevzdání uvidíš na odkazu
                  z jejich odpovědi.
                </SheetDescription>
              </SheetHeader>

              {createdUrl ? (
                <div className="mx-4 mb-1 flex flex-col gap-3 rounded-2xl border border-zinc-200/90 bg-[#f5f4f8] p-4 shadow-sm">
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

              <div className="flex flex-col gap-4 px-4 pb-3">

                <div className="space-y-3">
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
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {steps.map((step, index) => {
                      const stepDrag = dragActiveStep === index;
                      return (
                        <li key={index} className="rounded-xl border border-zinc-200/90 bg-zinc-50/40 p-3">
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
                                'flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-4 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1',
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
                  {busy ? 'Ukládám…' : 'Vytvořit zadání'}
                </Button>
              </div>

              <div className="mt-auto px-4 pb-6 pt-1">
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
                  Přednastavená zadání. Seznam upravíš v{' '}
                  <code className="text-[11px]">taskLibrary.ts</code>.
                </SheetDescription>
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {TASK_LIBRARY.length === 0 ? (
                  <p className="text-sm text-zinc-500 leading-relaxed">
                    Zatím žádné položky. Uprav{' '}
                    <code className="rounded bg-zinc-100 px-1 text-xs">taskLibrary.ts</code>.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {TASK_LIBRARY.map(entry => {
                      const link = resolveStudentLink(entry);
                      const id = entry.assignmentId?.trim();
                      const fromDb = id ? libraryDbImages[id] : undefined;
                      const imgSrc =
                        resolveLibraryImageSrc(entry.imageUrl) ??
                        (fromDb && fromDb.trim() ? fromDb : null);
                      return (
                        <li
                          key={entry.key}
                          className="rounded-xl border border-zinc-200 bg-white px-3 py-3 shadow-sm"
                        >
                          <div className="flex items-stretch gap-3">
                            <div className="min-w-0 flex-1 flex flex-col justify-between gap-3">
                              <div className="text-[1.1375rem] font-semibold text-zinc-900 leading-snug">
                                {entry.title}
                              </div>
                              {link ? (
                                <div className="flex flex-col items-start gap-1.5">
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

              <div className="shrink-0 border-t border-zinc-100 bg-white px-4 py-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setLibraryOpen(false)}
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  Zpět k vlastnímu zadání
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
