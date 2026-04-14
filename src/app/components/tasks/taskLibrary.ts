import { assignmentPublicUrl } from '@/app/utils/appUrl';

/**
 * Knihovna ukolu (prednastavene polozky). Doplnovat v tomto souboru.
 * Polozka: `title` + `assignmentId` (UUID), volitelne `studentUrl`.
 *
 * Nahled v kartě: automaticky z DB (`instruction_image` u daneho zadani), pokud existuje.
 * Volitelne `imageUrl` prebije nahled (staticke URL nebo soubor v public).
 */
export type TaskLibraryEntry = {
  key: string;
  title: string;
  assignmentId?: string;
  studentUrl?: string;
  imageUrl?: string;
};

export const TASK_LIBRARY: TaskLibraryEntry[] = [
  {
    key: 'ukol-95a0fa17',
    title: 'Jednoduchý elektrický obvod – žárovka',
    assignmentId: '95a0fa17-10f8-4e19-9fa1-d0df42ebb2ce',
  },
  {
    key: 'ukol-a093f1f2',
    title: 'Zadání a093f1f2',
    assignmentId: 'a093f1f2-f9c5-4b3b-ba17-83dd30c671f2',
  },
  {
    key: 'ukol-4bda280d',
    title: 'Zadání 4bda280d',
    assignmentId: '4bda280d-86ae-4ccf-801d-476bbe07a589',
  },
  {
    key: 'ukol-4bb304ed',
    title: 'Zadání 4bb304ed',
    assignmentId: '4bb304ed-cedd-489f-bdbd-5d71229978de',
  },
  {
    key: 'ukol-d7d9b68b',
    title: 'Zadání d7d9b68b',
    assignmentId: 'd7d9b68b-7cfa-4170-863c-6a4155c7b208',
  },
  {
    key: 'ukol-85c93054',
    title: 'Zadání 85c93054',
    assignmentId: '85c93054-2a74-4ed1-83fc-5f585e35e881',
  },
  {
    key: 'ukol-a3ba270d',
    title: 'Zadání a3ba270d',
    assignmentId: 'a3ba270d-34ab-42ee-91fb-e963576d6b97',
  },
];

/** Absolutni src pro <img> (Vite base + relativni cesta z public). */
export function resolveLibraryImageSrc(imageUrl: string | undefined): string | null {
  if (!imageUrl?.trim()) return null;
  const u = imageUrl.trim();
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u;
  const base = import.meta.env.BASE_URL;
  const path = u.startsWith('/') ? u.slice(1) : u;
  const baseNorm = base.endsWith('/') ? base : `${base}/`;
  return `${baseNorm}${path}`;
}

export function resolveStudentLink(entry: TaskLibraryEntry): string | null {
  if (entry.studentUrl?.trim()) return entry.studentUrl.trim();
  if (entry.assignmentId?.trim()) return assignmentPublicUrl(entry.assignmentId.trim());
  return null;
}
