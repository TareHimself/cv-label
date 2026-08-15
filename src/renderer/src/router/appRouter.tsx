import type { IProject, ITask } from '@shared/types'
import type { OptimisticSample } from '@renderer/types'
import { makeRouter } from './makeRouter'

export type AppRoutes = {
  projects: undefined
  tasks: { project: IProject }
  samples: { project: IProject; task: ITask }
  label: { project: IProject; task: ITask; samples: OptimisticSample[]; initial: number }
  'copy-annotations': { project: IProject; sourceTask: ITask }
}

// No page components imported here on purpose - pages' hooks import navigate/back from
// this module, so pulling in the page components here (which the RouterOutlet needs) would
// create a cycle. See router/RouterOutlet.tsx for that half.
export const appRouter = makeRouter<AppRoutes>('projects')
export const {
  navigate,
  back,
  useRouterStore,
  useIsRouteVisible,
  useOnRouteEnter,
  useOnRouteLeave
} = appRouter
