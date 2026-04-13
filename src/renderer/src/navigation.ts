import { IProject, ISample, ITask } from '@shared/types'
import { useLocation } from 'react-router'

export type TasksNavState = {
  project: IProject
}
export const navigateToTasks = (project: IProject) => {
  return window.navigate(`/tasks/${project.id}`, {
    state: {
      project
    }
  })
}

export const useTasksNavState = (): TasksNavState => {
  const location = useLocation()
  return location.state
}

export type SamplesNavState = TasksNavState & {
  task: ITask
}

export const navigateToSamples = (project: IProject, task: ITask) => {
  return window.navigate(`/samples/${task.id}`, {
    state: {
      project,
      task
    }
  })
}

export const useSamplesNavState = (): SamplesNavState => {
  const location = useLocation()
  return location.state
}

export type LabelNavState = SamplesNavState & {
  samples: ISample[]
  initial: number
}

export const navigateToLabel = (
  project: IProject,
  task: ITask,
  samples: ISample[],
  initial: number = 0
) => {
  return window.navigate(`/label/${task.id}`, {
    state: {
      project,
      task,
      samples,
      initial
    }
  })
}

export const useLabelNavState = (): LabelNavState => {
  const location = useLocation()
  return location.state
}

export const navigateToProjects = () => {
  return window.navigate(`/`)
}
