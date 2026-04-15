/**
 * Veřejný vstup pro blok „Úkoly“ — stejná DB / tabulky, hostitelská aplikace jen předá
 * `resolveAssignmentPublicUrl` a sdílí Supabase klient + schéma.
 */
export { TasksSheet, type TasksSheetProps } from '@/app/components/tasks/TasksSheet';
export {
  TASK_LIBRARY,
  resolveLibraryImageSrc,
  resolveStudentLink,
  type TaskLibraryEntry,
} from '@/app/components/tasks/taskLibrary';
export { CIRCUIT_ASSIGNMENTS_TABLE, CIRCUIT_SUBMISSIONS_TABLE } from '@/lib/circuitTables';
