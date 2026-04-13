export const enum LocalStoreKeys {
  Connect = 'localStore-connect',
  Disconnect = 'localStore-disconnect',

  GetProjects = 'localStore-getProjects',
  CreateProject = 'localStore-createProject',
  DeleteProjects = 'localStore-deleteProjects',

  GetTasks = 'localStore-getTasks',
  CreateTask = 'localStore-createTask',
  DeleteTasks = 'localStore-deleteTasks',

  GetSamplesForTask = 'localStore-getSamplesForTask',
  GetSamples = 'localStore-getSamples',
  CreateSamples = 'localStore-createSamples',
  DeleteSamples = 'localStore-deleteSamples',

  GetAnnotationsForSample = 'localStore-getAnnotationsForSample',
  CreateAnnotations = 'localStore-createAnnotations',
  UpdateAnnotations = 'localStore-updateAnnotations',
  DeleteAnnotations = 'localStore-deleteAnnotations',

  GetAnnotators = 'localStore-getAnnotators',
  CreateAnnotator = 'localStore-createAnnotator',
  DeleteAnnotators = 'localStore-deleteAnnotators',

  ReplacePoints = 'localStore-replacePoints'
}

export const enum SystemKeys {
  CreateTemporaryDirectory = 'system-createTemporaryDirectory',
  DeleteFile = 'system-deleteFile',
  DeleteDirectory = 'system-deleteDirectory'
}

export const enum ZipKeys {
  ExtractTo = 'zip-extractTo'
}
