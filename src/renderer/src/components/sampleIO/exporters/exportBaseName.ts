import type { IProject, ITask } from '@shared/types'

/** The file/folder base name to suggest for an export - a single task's own name when
 *  exporting just that one task (the common case from a per-task "Export" action), since
 *  the project name would be redundant/less specific there. Falls back to the project's
 *  name once more than one task is involved, where no single task name would make sense. */
export const exportBaseName = (project: IProject, tasks: ITask[]): string =>
  tasks.length === 1 ? tasks[0].name : project.name
