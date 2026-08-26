import type { IProject, ITask } from '@shared/types'

/** The base name to suggest for an export - a single task's own name for a per-task export, falling back to the project's name once multiple tasks are involved. */
export const exportBaseName = (project: IProject, tasks: ITask[]): string =>
  tasks.length === 1 ? tasks[0].name : project.name
