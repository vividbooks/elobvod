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
    key: 'ampermetr',
    title: 'Ampérmetr',
    assignmentId: 'e83e4b61-f053-4024-9d68-46befa731a1b',
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
