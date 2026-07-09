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

export interface ISampleUpdate extends Partial<OmitV2<ISample, 'annotations' | 'imageUri'>> {
  id: ISample['id']
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
  updateSamples(updates: ISampleUpdate[]): Promise<ISample[]>
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
  /** Shows a native save dialog defaulted to suggestedName; writes data to the chosen
   *  path. Returns false if the user cancelled the dialog. */
  saveFile(suggestedName: string, data: ArrayBuffer): Promise<boolean>
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

export enum IPCKeys {
  // LocalStore
  LocalStore_Connect = 'localStore-connect',
  LocalStore_Disconnect = 'localStore-disconnect',
  LocalStore_GetProjects = 'localStore-getProjects',
  LocalStore_CreateProject = 'localStore-createProject',
  LocalStore_DeleteProjects = 'localStore-deleteProjects',
  LocalStore_GetTasks = 'localStore-getTasks',
  LocalStore_CreateTask = 'localStore-createTask',
  LocalStore_DeleteTasks = 'localStore-deleteTasks',
  LocalStore_GetSamplesForTask = 'localStore-getSamplesForTask',
  LocalStore_GetSamples = 'localStore-getSamples',
  LocalStore_CreateSamples = 'localStore-createSamples',
  LocalStore_UpdateSamples = 'localStore-updateSamples',
  LocalStore_DeleteSamples = 'localStore-deleteSamples',
  LocalStore_GetAnnotationsForSample = 'localStore-getAnnotationsForSample',
  LocalStore_CreateAnnotations = 'localStore-createAnnotations',
  LocalStore_UpdateAnnotations = 'localStore-updateAnnotations',
  LocalStore_DeleteAnnotations = 'localStore-deleteAnnotations',
  LocalStore_GetAnnotators = 'localStore-getAnnotators',
  LocalStore_CreateAnnotator = 'localStore-createAnnotator',
  LocalStore_DeleteAnnotators = 'localStore-deleteAnnotators',
  LocalStore_ReplacePoints = 'localStore-replacePoints',

  // System
  System_CreateTemporaryDirectory = 'system-createTemporaryDirectory',
  System_DeleteFile = 'system-deleteFile',
  System_DeleteDirectory = 'system-deleteDirectory',
  System_SaveFile = 'system-saveFile',

  // Zip
  Zip_ExtractTo = 'zip-extractTo'
}

export type IPCEvents = {
  // LocalStore
  [IPCKeys.LocalStore_Connect]: IDataStore['connect']
  [IPCKeys.LocalStore_Disconnect]: IDataStore['disconnect']
  [IPCKeys.LocalStore_GetProjects]: IDataStore['getProjects']
  [IPCKeys.LocalStore_CreateProject]: IDataStore['createProject']
  [IPCKeys.LocalStore_DeleteProjects]: IDataStore['deleteProjects']
  [IPCKeys.LocalStore_GetTasks]: IDataStore['getTasksForProject']
  [IPCKeys.LocalStore_CreateTask]: IDataStore['createTask']
  [IPCKeys.LocalStore_DeleteTasks]: IDataStore['deleteTasks']
  [IPCKeys.LocalStore_GetSamplesForTask]: IDataStore['getSamplesForTask']
  [IPCKeys.LocalStore_GetSamples]: IDataStore['getSamples']
  [IPCKeys.LocalStore_CreateSamples]: IDataStore['createSamples']
  [IPCKeys.LocalStore_UpdateSamples]: IDataStore['updateSamples']
  [IPCKeys.LocalStore_DeleteSamples]: IDataStore['deleteSamples']
  [IPCKeys.LocalStore_GetAnnotationsForSample]: IDataStore['getAnnotationsForSample']
  [IPCKeys.LocalStore_CreateAnnotations]: IDataStore['createAnnotations']
  [IPCKeys.LocalStore_UpdateAnnotations]: IDataStore['updateAnnotations']
  [IPCKeys.LocalStore_DeleteAnnotations]: IDataStore['deleteAnnotations']
  [IPCKeys.LocalStore_GetAnnotators]: IDataStore['getAnnotators']
  [IPCKeys.LocalStore_CreateAnnotator]: IDataStore['createAnnotator']
  [IPCKeys.LocalStore_DeleteAnnotators]: IDataStore['deleteAnnotators']
  [IPCKeys.LocalStore_ReplacePoints]: IDataStore['replacePoints']

  // System
  [IPCKeys.System_CreateTemporaryDirectory]: ISystem['createTemporaryDirectory']
  [IPCKeys.System_DeleteFile]: ISystem['deleteFile']
  [IPCKeys.System_DeleteDirectory]: ISystem['deleteDirectory']
  [IPCKeys.System_SaveFile]: ISystem['saveFile']

  // Zip
  [IPCKeys.Zip_ExtractTo]: IZip['extractTo']
}
