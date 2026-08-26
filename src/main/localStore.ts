import { net } from 'electron'
import url from 'node:url'
import { importWorkerModule } from './worker'
import { getAppPath, getMigrationsPath } from './utils'
import databaseWorkerPath from './database?modulePath'
import {
  ArchiveManifest,
  IAnnotation,
  IAnnotationUpdate,
  ILabel,
  INewAnnotation,
  INewSample,
  IPoint,
  IPointReplacement,
  IProject,
  IProjectUpdate,
  ISample,
  ISampleUpdate,
  ITag,
  ITagUpdate,
  ITask,
  ITaskUpdate
} from '../shared/types'
import { IMainDataStore } from './storeOrchestrator'

/** The local/worker-backed IDataStore - lazily spawns its worker (opens SQLite, runs migrations) on first use instead of blocking app boot. ensureWorker() is memoized, no ordering requirement on connect() first. */
export class LocalStore implements IMainDataStore {
  #workerPromise?: Promise<typeof import('./database') & { terminate(): Promise<number> }>

  private ensureWorker() {
    this.#workerPromise ??= importWorkerModule<typeof import('./database')>(
      url.pathToFileURL(databaseWorkerPath),
      { APP_PATH: getAppPath(), MIGRATIONS_PATH: getMigrationsPath() }
    )
    return this.#workerPromise
  }

  connect = async (): Promise<void> => {
    await this.ensureWorker()
  }

  disconnect = async (): Promise<void> => {
    if (!this.#workerPromise) return
    const worker = await this.#workerPromise
    this.#workerPromise = undefined
    await worker.terminate()
  }

  getProjects = async (): Promise<IProject[]> => (await this.ensureWorker()).getProjects()

  createProject = async (id: string, name: string, labels: ILabel[]): Promise<IProject> =>
    (await this.ensureWorker()).createProject(id, name, labels)

  updateProjects = async (updates: IProjectUpdate[]): Promise<IProject[]> =>
    (await this.ensureWorker()).updateProjects(updates)

  deleteProjects = async (projectIds: string[]): Promise<boolean[]> =>
    (await this.ensureWorker()).deleteProjects(projectIds)

  getTasksForProject = async (projectId: string): Promise<ITask[]> =>
    (await this.ensureWorker()).getTasksForProject(projectId)

  createTask = async (
    projectId: string,
    id: string,
    name: string,
    newSamples?: INewSample[]
  ): Promise<ITask> => (await this.ensureWorker()).createTask(projectId, id, name, newSamples)

  updateTasks = async (updates: ITaskUpdate[]): Promise<ITask[]> =>
    (await this.ensureWorker()).updateTasks(updates)

  deleteTasks = async (taskIds: string[]): Promise<boolean[]> =>
    (await this.ensureWorker()).deleteTasks(taskIds)

  getTagsForProject = async (projectId: string): Promise<ITag[]> =>
    (await this.ensureWorker()).getTagsForProject(projectId)

  createTag = async (projectId: string, id: string, name: string): Promise<ITag> =>
    (await this.ensureWorker()).createTag(projectId, id, name)

  updateTags = async (updates: ITagUpdate[]): Promise<ITag[]> =>
    (await this.ensureWorker()).updateTags(updates)

  deleteTags = async (tagIds: string[]): Promise<boolean[]> =>
    (await this.ensureWorker()).deleteTags(tagIds)

  addTagsToTasks = async (taskIds: string[], tagIds: string[]): Promise<void> =>
    (await this.ensureWorker()).addTagsToTasks(taskIds, tagIds)

  removeTagsFromTasks = async (taskIds: string[], tagIds: string[]): Promise<void> =>
    (await this.ensureWorker()).removeTagsFromTasks(taskIds, tagIds)

  getSamplesForTask = async (taskId: string): Promise<ISample[]> =>
    (await this.ensureWorker()).getSamplesForTask(taskId)

  getSamples = async (sampleIds: string[]): Promise<ISample[]> =>
    (await this.ensureWorker()).getSamples(sampleIds)

  createSamples = async (taskId: string, samples: INewSample[]): Promise<ISample[]> =>
    (await this.ensureWorker()).createSamples(taskId, samples)

  updateSamples = async (updates: ISampleUpdate[]): Promise<ISample[]> =>
    (await this.ensureWorker()).updateSamples(updates)

  deleteSamples = async (sampleIds: string[]): Promise<boolean[]> =>
    (await this.ensureWorker()).deleteSamples(sampleIds)

  getAnnotationsForSample = async (sampleId: string): Promise<IAnnotation[]> =>
    (await this.ensureWorker()).getAnnotationsForSample(sampleId)

  createAnnotations = async (
    sampleId: string,
    annotations: INewAnnotation[]
  ): Promise<IAnnotation[]> => (await this.ensureWorker()).createAnnotations(sampleId, annotations)

  updateAnnotations = async (updates: IAnnotationUpdate[]): Promise<IAnnotation[]> =>
    (await this.ensureWorker()).updateAnnotations(updates)

  deleteAnnotations = async (annotationsIds: string[]): Promise<boolean[]> =>
    (await this.ensureWorker()).deleteAnnotations(annotationsIds)

  replacePoints = async (annotationId: string, points: IPointReplacement[]): Promise<IPoint[]> =>
    (await this.ensureWorker()).replacePoints(annotationId, points)

  exportSamplesToArchive = async (
    destinationPath: string,
    manifest: ArchiveManifest,
    concurrency?: number,
    onProgress?: (completed: number, total: number) => void
  ): Promise<void> =>
    (await this.ensureWorker()).exportSamplesToArchive(
      destinationPath,
      manifest,
      concurrency,
      onProgress
    )

  resolveImage = async (imageId: string): Promise<Response> => {
    const filePath = await (await this.ensureWorker()).getImagePathForId(imageId)
    if (filePath === undefined) {
      return new Response(undefined, { status: 404 })
    }
    return net.fetch(url.pathToFileURL(filePath).toString())
  }
}
