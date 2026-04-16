export type BoundaryResult<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: string
    }

export const enum AnnotationType {
  Box = 'box',
  Mask = 'mask'
}
export interface IPoint {
  id: string
  x: number
  y: number
}

export interface ILabel {
  id: string
  name: string
  color: string
}

export interface IProject {
  id: string
  name: string
  labels: ILabel[]
}

export interface ITask {
  id: string
  name: string
}

export enum TrainingSplit {
  Train = 'train',
  Test = 'test'
}

export interface INewSample {
  id: string
  name: string
  base64Image: string
  split: TrainingSplit
  annotations: IAnnotation[]
  createdAt: string
}

export interface ISample extends OmitV2<INewSample, 'base64Image'> {
  imageUri: string
  completedAt: string | null
}

export interface INewAnnotator {
  id: string
  name: string
  url: string
  headers: Record<string, string>
}

export interface IAnnotator extends INewAnnotator {}

export interface INewAnnotation {
  id: string
  type: AnnotationType
  labelId: string
  points: IPoint[]
}

export interface IAnnotation extends INewAnnotation {}

export interface IAnnotationUpdate extends Partial<OmitV2<IAnnotation, 'points'>> {
  id: IAnnotation['id']
}

export interface IPointUpdate extends Partial<IPoint> {
  id: IPoint['id']
}

export interface INewPoint {
  id: string
  annotationId: IAnnotation['id']
  x: number
  y: number
}

export type IPointReplacement = INewPoint | IPointUpdate

export interface IDataStore {
  connect(): Promise<void>
  disconnect(): Promise<void>

  getProjects(): Promise<IProject[]>
  createProject(id: string, name: string, labels: ILabel[]): Promise<IProject>
  deleteProjects(projectIds: string[]): Promise<boolean[]>

  getTasksForProject(projectId: string): Promise<ITask[]>
  createTask(projectId: string, id: string, name: string, newSamples?: INewSample[]): Promise<ITask>
  deleteTasks(taskIds: string[]): Promise<boolean[]>

  getSamplesForTask(taskId: string): Promise<ISample[]>
  getSamples(sampleIds: string[]): Promise<ISample[]>
  createSamples(taskId: string, samples: INewSample[]): Promise<ISample[]>
  deleteSamples(sampleIds: string[]): Promise<boolean[]>

  getAnnotationsForSample(sampleId: string): Promise<IAnnotation[]>
  createAnnotations(sampleId: string, annotations: INewAnnotation[]): Promise<IAnnotation[]>
  updateAnnotations(updates: IAnnotationUpdate[]): Promise<IAnnotation[]>
  deleteAnnotations(annotationsIds: string[]): Promise<boolean[]>

  getAnnotators(projectId: string): Promise<IAnnotator[]>
  createAnnotator(
    projectId: string,
    id: string,
    name: string,
    url: string,
    headers: Record<string, string>
  ): Promise<IAnnotator>
  deleteAnnotators(annotatorIds: string[]): Promise<boolean[]>

  replacePoints(annotationId: string, points: IPointReplacement[]): Promise<IPoint[]>
}

export interface ISystem {
  createTemporaryDirectory(): Promise<string>
  deleteFile(filePath: string): Promise<void>
  deleteDirectory(filePath: string): Promise<void>
}

export interface IZip {
  // getKeys(filePath: string): Promise<string[]>
  extractTo(filePath: string, destination: string): Promise<void>
}

export type WrapMethodsWithBoundary<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => Promise<infer R>
    ? (...args: A) => Promise<BoundaryResult<R>>
    : T[K]
}

export type OmitV2<T, K extends keyof T> = Omit<T, K>
