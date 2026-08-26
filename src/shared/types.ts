/** Privileged protocol serving arbitrary local scratch files to the renderer - request/response (mint an id, hand back `scratch://<id>`) since a raw file path can't safely go in the URL itself. See main/scratchProtocol.ts. */
export const SCRATCH_PROTOCOL_URL = 'scratch'

/** Privileged protocol serving persisted sample images: `image://<storeId>/<imageId>.<ext>` - storeId lets main/store.ts dispatch to whichever IDataStore produced the image. */
export const IMAGE_PROTOCOL_URL = 'image'

/** The id the always-registered local/worker-backed store is known by - see main/localStore.ts, main/storeOrchestrator.ts. */
export const LOCAL_STORE_ID = 'local'

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
  Polygon = 'polygon'
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

/** Renames the project and edits/adds labels - can't remove one here, since one already used by an annotation would violate a foreign key. */
export interface IProjectUpdate {
  id: IProject['id']
  name?: string
  labels?: Pick<ILabel, 'id' | 'name' | 'color'>[]
}

export interface ITag {
  id: string
  name: string
}

export interface ITagUpdate {
  id: ITag['id']
  name?: string
}

export interface ITask {
  id: string
  name: string
  /** Absent, not 0, when unknown - only getTasksForProject/createTask populate these. */
  sampleCount?: number
  completedSampleCount?: number
  tags?: ITag[]
}

export interface ITaskUpdate {
  id: ITask['id']
  name?: string
}

export enum TrainingSplit {
  Train = 'train',
  Test = 'test',
  Valid = 'valid'
}

export interface INewSample {
  id: string
  name: string
  /** Absolute path to a scratch file on disk, written by whichever importer built this sample - always a reference, never held bytes. */
  imagePath: string
  split: TrainingSplit
  annotations: IAnnotation[]
  createdAt: string
}

export interface ISample extends OmitV2<INewSample, 'imagePath'> {
  imageUri: string
  width: number
  height: number
  completedAt: string | null
}

export interface ISampleUpdate extends Partial<OmitV2<ISample, 'annotations' | 'imageUri'>> {
  id: ISample['id']
}

/** Store-agnostic and project-agnostic connection info for an external annotator server - see main/appStore.ts. Its label mapping is never persisted, only rebuilt live in renderer memory. */
export interface INewAnnotator {
  id: string
  name: string
  url: string
  headers: Record<string, string>
}

export interface IAnnotator extends INewAnnotator {}

export interface IAnnotatorUpdate extends Partial<OmitV2<IAnnotator, 'id'>> {
  id: IAnnotator['id']
}

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
  updateProjects(updates: IProjectUpdate[]): Promise<IProject[]>
  deleteProjects(projectIds: string[]): Promise<boolean[]>

  getTasksForProject(projectId: string): Promise<ITask[]>
  createTask(projectId: string, id: string, name: string, newSamples?: INewSample[]): Promise<ITask>
  updateTasks(updates: ITaskUpdate[]): Promise<ITask[]>
  deleteTasks(taskIds: string[]): Promise<boolean[]>

  /** A project-global vocabulary managed from one place (ManageTagsModal) - a tag is always picked by id elsewhere, never typed. */
  getTagsForProject(projectId: string): Promise<ITag[]>
  createTag(projectId: string, id: string, name: string): Promise<ITag>
  updateTags(updates: ITagUpdate[]): Promise<ITag[]>
  deleteTags(tagIds: string[]): Promise<boolean[]>

  /** Attaches/detaches existing tags (by id) to/from every task in taskIds - never a per-task "replace the whole set" operation. */
  addTagsToTasks(taskIds: string[], tagIds: string[]): Promise<void>
  removeTagsFromTasks(taskIds: string[], tagIds: string[]): Promise<void>

  getSamplesForTask(taskId: string): Promise<ISample[]>
  getSamples(sampleIds: string[]): Promise<ISample[]>
  createSamples(taskId: string, samples: INewSample[]): Promise<ISample[]>
  updateSamples(updates: ISampleUpdate[]): Promise<ISample[]>
  deleteSamples(sampleIds: string[]): Promise<boolean[]>

  getAnnotationsForSample(sampleId: string): Promise<IAnnotation[]>
  createAnnotations(sampleId: string, annotations: INewAnnotation[]): Promise<IAnnotation[]>
  updateAnnotations(updates: IAnnotationUpdate[]): Promise<IAnnotation[]>
  deleteAnnotations(annotationsIds: string[]): Promise<boolean[]>

  replacePoints(annotationId: string, points: IPointReplacement[]): Promise<IPoint[]>
}

/** The always-on, store-agnostic counterpart to IDataStore - annotators live here, not in whichever IDataStore is active, so App_* IPC skips StoreOrchestrator entirely. */
export interface IAppDataStore {
  getAnnotators(): Promise<IAnnotator[]>
  createAnnotator(
    id: string,
    name: string,
    url: string,
    headers: Record<string, string>
  ): Promise<IAnnotator>
  updateAnnotators(updates: IAnnotatorUpdate[]): Promise<IAnnotator[]>
  deleteAnnotators(annotatorIds: string[]): Promise<boolean[]>
}

export type StoreDescriptor = { id: string; name: string }

/** Lets the renderer list/switch which registered IDataStore main is routing Store_* IPC to - orchestration, not data operations. See main/storeOrchestrator.ts. */
export interface IStoreManager {
  listStores(): Promise<StoreDescriptor[]>
  useStore(id: string): Promise<void>
}

export interface ISystem {
  createTemporaryDirectory(): Promise<string>
  deleteFile(filePath: string): Promise<void>
  deleteDirectory(filePath: string): Promise<void>
  /** Shows a native save dialog defaulted to suggestedName; returns false if cancelled. */
  saveFile(suggestedName: string, data: ArrayBuffer): Promise<boolean>
  /** Writes data to an explicit local path - no dialog, unlike saveFile. */
  writeFile(filePath: string, data: ArrayBuffer): Promise<void>
  readTextFile(filePath: string): Promise<string>
  /** Relative, forward-slash paths of every file under dirPath (recursive). */
  listFilesRecursive(dirPath: string): Promise<string[]>
  getFileSize(filePath: string): Promise<number>
  /** Reads just enough of the file to determine dimensions - never loads the full image into memory. */
  getImageDimensions(filePath: string): Promise<{ width: number; height: number }>
  /** Mints a scratch://<id> URI resolving back to filePath - see SCRATCH_PROTOCOL_URL. */
  getScratchPreviewUri(filePath: string): Promise<string>
}

export interface IZip {
  extractTo(filePath: string, destination: string): Promise<void>
}

export interface IFileUtils {
  /** The real absolute path of a picked File - Electron's webUtils.getPathForFile. Returns '' for a File with no real on-disk path. */
  getPathForFile(file: File): string
}

export type ArchiveTextEntry = { path: string; content: string }
export type ArchiveImageEntry = { path: string; imageUri: string }
export type ArchiveManifest = { textEntries: ArchiveTextEntry[]; imageEntries: ArchiveImageEntry[] }
export type ExportProgressEvent = { completed: number; total: number }

export interface IExportApi {
  /** Streams manifest's entries into a zip at a user-chosen path - image entries never fully buffer in the renderer. False if cancelled. */
  runExport(suggestedName: string, manifest: ArchiveManifest): Promise<boolean>
  /** Subscribes to progress for the in-flight export; returns an unsubscribe function. */
  onProgress(callback: (event: ExportProgressEvent) => void): () => void
}

export type WrapMethodsWithBoundary<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => Promise<infer R>
    ? (...args: A) => Promise<BoundaryResult<R>>
    : T[K]
}

export type OmitV2<T, K extends keyof T> = Omit<T, K>

export enum IPCKeys {
  // Store
  Store_Connect = 'store-connect',
  Store_Disconnect = 'store-disconnect',
  Store_GetProjects = 'store-getProjects',
  Store_CreateProject = 'store-createProject',
  Store_UpdateProjects = 'store-updateProjects',
  Store_DeleteProjects = 'store-deleteProjects',
  Store_GetTasks = 'store-getTasks',
  Store_CreateTask = 'store-createTask',
  Store_UpdateTasks = 'store-updateTasks',
  Store_DeleteTasks = 'store-deleteTasks',
  Store_GetTagsForProject = 'store-getTagsForProject',
  Store_CreateTag = 'store-createTag',
  Store_UpdateTags = 'store-updateTags',
  Store_DeleteTags = 'store-deleteTags',
  Store_AddTagsToTasks = 'store-addTagsToTasks',
  Store_RemoveTagsFromTasks = 'store-removeTagsFromTasks',
  Store_GetSamplesForTask = 'store-getSamplesForTask',
  Store_GetSamples = 'store-getSamples',
  Store_CreateSamples = 'store-createSamples',
  Store_UpdateSamples = 'store-updateSamples',
  Store_DeleteSamples = 'store-deleteSamples',
  Store_GetAnnotationsForSample = 'store-getAnnotationsForSample',
  Store_CreateAnnotations = 'store-createAnnotations',
  Store_UpdateAnnotations = 'store-updateAnnotations',
  Store_DeleteAnnotations = 'store-deleteAnnotations',
  Store_ReplacePoints = 'store-replacePoints',
  Store_List = 'store-list',
  Store_UseStore = 'store-useStore',

  // App (store-agnostic, always active - see main/appStore.ts)
  App_GetAnnotators = 'app-getAnnotators',
  App_CreateAnnotator = 'app-createAnnotator',
  App_UpdateAnnotators = 'app-updateAnnotators',
  App_DeleteAnnotators = 'app-deleteAnnotators',

  // System
  System_CreateTemporaryDirectory = 'system-createTemporaryDirectory',
  System_DeleteFile = 'system-deleteFile',
  System_DeleteDirectory = 'system-deleteDirectory',
  System_SaveFile = 'system-saveFile',
  System_WriteFile = 'system-writeFile',
  System_ReadTextFile = 'system-readTextFile',
  System_ListFilesRecursive = 'system-listFilesRecursive',
  System_GetFileSize = 'system-getFileSize',
  System_GetImageDimensions = 'system-getImageDimensions',
  System_GetScratchPreviewUri = 'system-getScratchPreviewUri',

  // Zip
  Zip_ExtractTo = 'zip-extractTo',

  // Export
  Export_Run = 'export-run',
  /** Main -> renderer push channel carrying ExportProgressEvent while Export_Run is in flight. */
  Export_Progress = 'export-progress'
}

export type IPCEvents = {
  // Store
  [IPCKeys.Store_Connect]: IDataStore['connect']
  [IPCKeys.Store_Disconnect]: IDataStore['disconnect']
  [IPCKeys.Store_GetProjects]: IDataStore['getProjects']
  [IPCKeys.Store_CreateProject]: IDataStore['createProject']
  [IPCKeys.Store_UpdateProjects]: IDataStore['updateProjects']
  [IPCKeys.Store_DeleteProjects]: IDataStore['deleteProjects']
  [IPCKeys.Store_GetTasks]: IDataStore['getTasksForProject']
  [IPCKeys.Store_CreateTask]: IDataStore['createTask']
  [IPCKeys.Store_UpdateTasks]: IDataStore['updateTasks']
  [IPCKeys.Store_DeleteTasks]: IDataStore['deleteTasks']
  [IPCKeys.Store_GetTagsForProject]: IDataStore['getTagsForProject']
  [IPCKeys.Store_CreateTag]: IDataStore['createTag']
  [IPCKeys.Store_UpdateTags]: IDataStore['updateTags']
  [IPCKeys.Store_DeleteTags]: IDataStore['deleteTags']
  [IPCKeys.Store_AddTagsToTasks]: IDataStore['addTagsToTasks']
  [IPCKeys.Store_RemoveTagsFromTasks]: IDataStore['removeTagsFromTasks']
  [IPCKeys.Store_GetSamplesForTask]: IDataStore['getSamplesForTask']
  [IPCKeys.Store_GetSamples]: IDataStore['getSamples']
  [IPCKeys.Store_CreateSamples]: IDataStore['createSamples']
  [IPCKeys.Store_UpdateSamples]: IDataStore['updateSamples']
  [IPCKeys.Store_DeleteSamples]: IDataStore['deleteSamples']
  [IPCKeys.Store_GetAnnotationsForSample]: IDataStore['getAnnotationsForSample']
  [IPCKeys.Store_CreateAnnotations]: IDataStore['createAnnotations']
  [IPCKeys.Store_UpdateAnnotations]: IDataStore['updateAnnotations']
  [IPCKeys.Store_DeleteAnnotations]: IDataStore['deleteAnnotations']
  [IPCKeys.Store_ReplacePoints]: IDataStore['replacePoints']
  [IPCKeys.Store_List]: IStoreManager['listStores']
  [IPCKeys.Store_UseStore]: IStoreManager['useStore']

  // App
  [IPCKeys.App_GetAnnotators]: IAppDataStore['getAnnotators']
  [IPCKeys.App_CreateAnnotator]: IAppDataStore['createAnnotator']
  [IPCKeys.App_UpdateAnnotators]: IAppDataStore['updateAnnotators']
  [IPCKeys.App_DeleteAnnotators]: IAppDataStore['deleteAnnotators']

  // System
  [IPCKeys.System_CreateTemporaryDirectory]: ISystem['createTemporaryDirectory']
  [IPCKeys.System_DeleteFile]: ISystem['deleteFile']
  [IPCKeys.System_DeleteDirectory]: ISystem['deleteDirectory']
  [IPCKeys.System_SaveFile]: ISystem['saveFile']
  [IPCKeys.System_WriteFile]: ISystem['writeFile']
  [IPCKeys.System_ReadTextFile]: ISystem['readTextFile']
  [IPCKeys.System_ListFilesRecursive]: ISystem['listFilesRecursive']
  [IPCKeys.System_GetFileSize]: ISystem['getFileSize']
  [IPCKeys.System_GetImageDimensions]: ISystem['getImageDimensions']
  [IPCKeys.System_GetScratchPreviewUri]: ISystem['getScratchPreviewUri']

  // Zip
  [IPCKeys.Zip_ExtractTo]: IZip['extractTo']

  // Export
  [IPCKeys.Export_Run]: IExportApi['runExport']
}
