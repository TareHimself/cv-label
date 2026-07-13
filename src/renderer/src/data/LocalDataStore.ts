import {
  IAnnotation,
  IAnnotationUpdate,
  IDataStore,
  IAnnotator,
  INewAnnotation,
  ILabel,
  INewSample,
  IPoint,
  IPointReplacement,
  IProject,
  IProjectUpdate,
  ISample,
  ISampleUpdate,
  ITask,
  ITaskUpdate
} from '@shared/types'

export class LocalDataStore implements IDataStore {
  connect(): Promise<void> {
    return window.localStore.connect()
  }
  disconnect(): Promise<void> {
    return window.localStore.disconnect()
  }

  getProjects(): Promise<IProject[]> {
    return window.localStore.getProjects()
  }

  createProject(id: string, name: string, labels: ILabel[]): Promise<IProject> {
    return window.localStore.createProject(id, name, labels)
  }

  updateProjects(updates: IProjectUpdate[]): Promise<IProject[]> {
    return window.localStore.updateProjects(updates)
  }

  deleteProjects(projectIds: string[]): Promise<boolean[]> {
    return window.localStore.deleteProjects(projectIds)
  }

  getTasksForProject(projectId: string): Promise<ITask[]> {
    return window.localStore.getTasksForProject(projectId)
  }

  createTask(
    projectId: string,
    id: string,
    name: string,
    newSamples?: INewSample[]
  ): Promise<ITask> {
    return window.localStore.createTask(projectId, id, name, newSamples)
  }

  updateTasks(updates: ITaskUpdate[]): Promise<ITask[]> {
    return window.localStore.updateTasks(updates)
  }

  deleteTasks(taskIds: string[]): Promise<boolean[]> {
    return window.localStore.deleteTasks(taskIds)
  }

  getSamplesForTask(taskId: string): Promise<ISample[]> {
    return window.localStore.getSamplesForTask(taskId)
  }

  getSamples(sampleIds: string[]): Promise<ISample[]> {
    return window.localStore.getSamples(sampleIds)
  }

  createSamples(taskId: string, samples: INewSample[]): Promise<ISample[]> {
    return window.localStore.createSamples(taskId, samples)
  }

  updateSamples(updates: ISampleUpdate[]): Promise<ISample[]> {
    return window.localStore.updateSamples(updates)
  }

  deleteSamples(sampleIds: string[]): Promise<boolean[]> {
    return window.localStore.deleteSamples(sampleIds)
  }

  getAnnotationsForSample(sampleId: string): Promise<IAnnotation[]> {
    return window.localStore.getAnnotationsForSample(sampleId)
  }

  createAnnotations(sampleId: string, annotations: INewAnnotation[]): Promise<IAnnotation[]> {
    return window.localStore.createAnnotations(sampleId, annotations)
  }

  updateAnnotations(updates: IAnnotationUpdate[]): Promise<IAnnotation[]> {
    return window.localStore.updateAnnotations(updates)
  }

  deleteAnnotations(annotationsIds: string[]): Promise<boolean[]> {
    return window.localStore.deleteAnnotations(annotationsIds)
  }

  getAnnotators(projectId: string): Promise<IAnnotator[]> {
    return window.localStore.getAnnotators(projectId)
  }

  createAnnotator(
    projectId: string,
    id: string,
    name: string,
    url: string,
    headers: Record<string, string>
  ): Promise<IAnnotator> {
    return window.localStore.createAnnotator(projectId, id, name, url, headers)
  }
  deleteAnnotators(externalAnnotatorIds: string[]): Promise<boolean[]> {
    return window.localStore.deleteAnnotators(externalAnnotatorIds)
  }

  replacePoints(annotationId: string, points: IPointReplacement[]): Promise<IPoint[]> {
    return window.localStore.replacePoints(annotationId, points)
  }
}
