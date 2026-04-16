/**
 * Veřejný vstup pro blok „Úkoly“ — stejná DB / tabulky; host může předat klienta, URL builder,
 * knihovnu, název tabulky a branding.
 */
export { TasksSheet, type TasksSheetProps, type TasksSheetSupabaseConfigInfo } from '@/app/components/tasks/TasksSheet';
export {
  TASK_LIBRARY,
  parseAssignmentIdFromUrlOrUuid,
  resolveLibraryImageSrc,
  resolveStudentLink,
  type TaskLibraryEntry,
} from '@/app/components/tasks/taskLibrary';
export { CIRCUIT_ASSIGNMENTS_TABLE, CIRCUIT_SUBMISSIONS_TABLE } from '@/lib/circuitTables';
