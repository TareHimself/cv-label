import { ProjectsPage } from '@renderer/routes/projects/ProjectsPage'
import { TasksPage } from '@renderer/routes/tasks/TasksPage'
import { SamplesPage } from '@renderer/routes/samples/SamplesPage'
import { LabelPage } from '@renderer/routes/label/LabelPage'
import { makeRouterOutlet } from './makeRouter'
import { useRouterStore, type AppRoutes } from './appRouter'

// Only App.tsx should import this module: it pulls in every page component to build the
// stack, and those pages' hooks import navigate/back from appRouter.tsx - importing this
// file from anywhere reachable by a page would recreate that cycle.
export const RouterOutlet = makeRouterOutlet<AppRoutes>(useRouterStore, {
  projects: ProjectsPage,
  tasks: TasksPage,
  samples: SamplesPage,
  label: LabelPage
})
