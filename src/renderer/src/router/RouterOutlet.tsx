import { ProjectsPage } from '@renderer/routes/projects/ProjectsPage'
import { TasksPage } from '@renderer/routes/tasks/TasksPage'
import { CopyAnnotationsPage } from '@renderer/routes/tasks/CopyAnnotationsPage'
import { SamplesPage } from '@renderer/routes/samples/SamplesPage'
import { LabelPage } from '@renderer/routes/label/LabelPage'
import { makeRouterOutlet } from './makeRouter'
import { appRouter, type AppRoutes } from './appRouter'

// Only App.tsx should import this - it pulls in every page component, and pages' hooks import navigate/back from appRouter.tsx, so importing this from a page would recreate that cycle.
export const RouterOutlet = makeRouterOutlet<AppRoutes>(appRouter, {
  projects: ProjectsPage,
  tasks: TasksPage,
  'copy-annotations': CopyAnnotationsPage,
  samples: SamplesPage,
  label: LabelPage
})
