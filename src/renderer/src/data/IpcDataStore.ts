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

/** A generic proxy to whatever IDataStore main currently has active - it doesn't know or
 *  care which backend that is, main's StoreOrchestrator handles that entirely. */
export class IpcDataStore implements IDataStore {
  connect(): Promise<void> {
    return window.store.connect()
  }
  disconnect(): Promise<void> {
    return window.store.disconnect()
  }

  getProjects(): Promise<IProject[]> {
    return window.store.getProjects()
  }

  createProject(id: string, name: string, labels: ILabel[]): Promise<IProject> {
    return window.store.createProject(id, name, labels)
  }

  updateProjects(updates: IProjectUpdate[]): Promise<IProject[]> {
    return window.store.updateProjects(updates)
  }

  deleteProjects(projectIds: string[]): Promise<boolean[]> {
    return window.store.deleteProjects(projectIds)
  }

  getTasksForProject(projectId: string): Promise<ITask[]> {
    return window.store.getTasksForProject(projectId)
  }

  createTask(
    projectId: string,
    id: string,
    name: string,
    newSamples?: INewSample[]
  ): Promise<ITask> {
    return window.store.createTask(projectId, id, name, newSamples)
  }

  updateTasks(updates: ITaskUpdate[]): Promise<ITask[]> {
    return window.store.updateTasks(updates)
  }

  deleteTasks(taskIds: string[]): Promise<boolean[]> {
    return window.store.deleteTasks(taskIds)
  }

  getSamplesForTask(taskId: string): Promise<ISample[]> {
    return window.store.getSamplesForTask(taskId)
  }

  getSamples(sampleIds: string[]): Promise<ISample[]> {
    return window.store.getSamples(sampleIds)
  }

  createSamples(taskId: string, samples: INewSample[]): Promise<ISample[]> {
    return window.store.createSamples(taskId, samples)
  }

  updateSamples(updates: ISampleUpdate[]): Promise<ISample[]> {
    return window.store.updateSamples(updates)
  }

  deleteSamples(sampleIds: string[]): Promise<boolean[]> {
    return window.store.deleteSamples(sampleIds)
  }

  getAnnotationsForSample(sampleId: string): Promise<IAnnotation[]> {
    return window.store.getAnnotationsForSample(sampleId)
  }

  createAnnotations(sampleId: string, annotations: INewAnnotation[]): Promise<IAnnotation[]> {
    return window.store.createAnnotations(sampleId, annotations)
  }

  updateAnnotations(updates: IAnnotationUpdate[]): Promise<IAnnotation[]> {
    return window.store.updateAnnotations(updates)
  }

  deleteAnnotations(annotationsIds: string[]): Promise<boolean[]> {
    return window.store.deleteAnnotations(annotationsIds)
  }

  getAnnotators(projectId: string): Promise<IAnnotator[]> {
    return window.store.getAnnotators(projectId)
  }

  createAnnotator(
    projectId: string,
    id: string,
    name: string,
    url: string,
    headers: Record<string, string>
  ): Promise<IAnnotator> {
    return window.store.createAnnotator(projectId, id, name, url, headers)
  }
  deleteAnnotators(externalAnnotatorIds: string[]): Promise<boolean[]> {
    return window.store.deleteAnnotators(externalAnnotatorIds)
  }

  replacePoints(annotationId: string, points: IPointReplacement[]): Promise<IPoint[]> {
    return window.store.replacePoints(annotationId, points)
  }
}
