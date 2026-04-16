// Will be loaded in a worker thread, cant use any electron API's
import {
  IAnnotation,
  IAnnotator,
  IDataStore,
  ILabel,
  INewAnnotation,
  INewAnnotator,
  INewSample,
  IPoint,
  IPointReplacement,
  IProject,
  ISample,
  ITask,
  OmitV2
} from '../shared/types'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs/promises'
import sharp from 'sharp'
import { makeUUID } from '../shared/utils'
import assert from 'assert'
import { sha512 } from './utils_no_electron'

console.log('Database loaded into worker', APP_PATH)
declare global {
  const APP_PATH: string
}

assert(APP_PATH !== undefined, 'APP_PATH global was not defined')

interface IStoredAnnotation extends OmitV2<INewAnnotation, 'points'> {
  sampleId: string
}

interface IStoredAnnotator extends OmitV2<INewAnnotator, 'headers'> {
  headers: string
  projectId: string
}

interface IStoredSample extends OmitV2<INewSample, 'base64Image' | 'annotations'> {
  taskId: string
  imageId: string
  completedAt?: string
}

type DatabasePoint = {
  id: string
  x: number
  y: number
  sequence: number
}

const storePath = path.join(APP_PATH, 'store')
const databasePath = path.join(storePath, 'database', 'data.db')
const imagesPath = path.join(storePath, 'images')

await fs.mkdir(imagesPath, { recursive: true })
await fs.mkdir(path.dirname(databasePath), { recursive: true })

const db = new Database(databasePath, { fileMustExist: false })

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
    CREATE TABLE IF NOT EXISTS projects(
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS annotators(
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        headers TEXT NOT NULL,
        projectId TEXT NOT NULL,
        FOREIGN KEY(projectId) REFERENCES projects(id)
            ON DELETE CASCADE
            ON UPDATE RESTRICT
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS tasks(
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        projectId TEXT NOT NULL,
        FOREIGN KEY(projectId) REFERENCES projects(id)
            ON DELETE CASCADE
            ON UPDATE RESTRICT
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS labels(
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        projectId TEXT NOT NULL,
        FOREIGN KEY(projectId) REFERENCES projects(id)
            ON DELETE CASCADE
            ON UPDATE RESTRICT
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS images(
        id TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        extension TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS samples(
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        split TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        completedAt TEXT,
        imageId TEXT NOT NULL,
        taskId TEXT NOT NULL,
        FOREIGN KEY(imageId) REFERENCES images(id),
        FOREIGN KEY(taskId) REFERENCES tasks(id)
            ON DELETE CASCADE
            ON UPDATE RESTRICT
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS annotations(
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        labelId TEXT NOT NULL,
        sampleId TEXT NOT NULL,
        FOREIGN KEY(labelId) REFERENCES labels(id)
            ON DELETE RESTRICT
            ON UPDATE RESTRICT,
        FOREIGN KEY(sampleId) REFERENCES samples(id)
            ON DELETE CASCADE
            ON UPDATE RESTRICT
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS points(
        id TEXT PRIMARY KEY,
        x REAL NOT NULL,
        y REAL NOT NULL,
        sequence INTEGER NOT NULL,
        annotationId TEXT NOT NULL,
        FOREIGN KEY(annotationId) REFERENCES annotations(id)
            ON DELETE CASCADE
            ON UPDATE RESTRICT
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS idx_annotators_projectId ON annotators(projectId);
    CREATE INDEX IF NOT EXISTS idx_tasks_projectId ON tasks(projectId);
    CREATE INDEX IF NOT EXISTS idx_labels_projectId ON labels(projectId);
    CREATE INDEX IF NOT EXISTS idx_samples_taskId ON samples(taskId);
    CREATE INDEX IF NOT EXISTS idx_samples_imageId ON samples(imageId);
    CREATE INDEX IF NOT EXISTS idx_annotations_sampleId ON annotations(sampleId);
    CREATE INDEX IF NOT EXISTS idx_annotations_labelId ON annotations(labelId);
    CREATE INDEX IF NOT EXISTS idx_points_annotationId ON points(annotationId);
`)

const GetProjectsStatement = db.prepare<[], Pick<IProject, 'id' | 'name'>>(
  `SELECT * FROM projects ORDER BY id ASC`
)

const CreateProjectStatement = db.prepare<Pick<IProject, 'id' | 'name'>>(
  `INSERT INTO projects (id,name) VALUES (@id,@name)`
)

const CreateProjectTransaction = db.transaction(
  (id: IProject['id'], name: IProject['name'], labels: ILabel[]): IProject => {
    CreateProjectStatement.run({ id: id, name: name })
    for (const label of labels) {
      CreateLabelStatement.run({ ...label, projectId: id })
    }

    return { id, name, labels }
  }
)

const DeleteProjectStatement = db.prepare<{
  id: IProject['id']
}>('DELETE FROM projects WHERE id = @id')

const DeleteProjectsTransaction = db.transaction((ids: string[]) => {
  for (const id of ids) {
    DeleteProjectStatement.run({ id: id })
  }
})

const CreateImageStatement = db.prepare<DatabaseImage>(
  `INSERT INTO images (id,hash,extension) VALUES (@id,@hash,@extension)`
)

const GetLabelsStatement = db.prepare<{ projectId: IProject['id'] }, ILabel>(
  `SELECT id,name,color FROM labels WHERE projectId = @projectId ORDER BY id ASC`
)

const GetTasksStatement = db.prepare<{ projectId: IProject['id'] }, ITask>(
  `SELECT id,name FROM tasks WHERE projectId = @projectId ORDER BY id ASC`
)

type DatabaseImage = {
  id: string
  hash: string
  extension: string
}

const GetImageByIdStatement = db.prepare<[id: string], DatabaseImage>(
  `SELECT * FROM images WHERE id = ?`
)

const GetImageByHashStatement = db.prepare<[hash: string], DatabaseImage>(
  `SELECT * FROM images WHERE hash = ?`
)

const CreateLabelStatement = db.prepare<ILabel & { projectId: string }>(
  `INSERT INTO labels (id,name,color,projectId) VALUES (@id,@name,@color,@projectId)`
)

const CreateTaskStatement = db.prepare<ITask & { projectId: string }>(
  `INSERT INTO tasks (id,name,projectId) VALUES (@id,@name,@projectId)`
)

const GetAnnotationsStatement = db.prepare<[sampleId: string], IStoredAnnotation>(
  `SELECT id, type, labelId, sampleId FROM annotations WHERE sampleId = ? ORDER BY id ASC`
)

const CreateAnnotationStatement = db.prepare<IStoredAnnotation>(
  `INSERT INTO annotations (id,type,labelId,sampleId) VALUES (@id,@type,@labelId,@sampleId)`
)

const GetAnnotationByIdStatement = db.prepare<[id: string], IStoredAnnotation>(
  `SELECT id, type, labelId, sampleId FROM annotations WHERE id = ?`
)

const UpdateAnnotationStatement = db.prepare<Pick<IStoredAnnotation, 'id' | 'type' | 'labelId'>>(
  `UPDATE annotations SET type = @type, labelId = @labelId WHERE id = @id`
)

const CreatePointStatement = db.prepare<{
  id: string
  x: number
  y: number
  sequence: number
  annotationId: string
}>(`INSERT INTO points (id,x,y,sequence,annotationId) VALUES (@id,@x,@y,@sequence,@annotationId)`)

const GetPointsStatement = db.prepare<[annotationId: string], DatabasePoint>(
  `SELECT id, x, y, sequence FROM points WHERE annotationId = ? ORDER BY sequence ASC`
)

const GetPointsWithoutSequenceStatement = db.prepare<[annotationId: string], IPoint>(
  `SELECT id, x, y FROM points WHERE annotationId = ? ORDER BY sequence ASC`
)

const UpdatePointStatement = db.prepare<{
  id: string
  x: number
  y: number
  sequence: number
}>(`UPDATE points SET x = @x, y = @y, sequence = @sequence WHERE id = @id`)

const DeletePointStatement = db.prepare<[id: string]>('DELETE FROM points WHERE id = ?')

const GetSampleStatement = db.prepare<[taskId: string], IStoredSample>(
  `SELECT * FROM samples WHERE taskId = ? ORDER BY id ASC`
)

const GetSampleByIdStatement = db.prepare<[sampleId: string], IStoredSample>(
  `SELECT * FROM samples WHERE id = ?`
)

const CreateSampleStatement = db.prepare<IStoredSample>(
  `INSERT INTO samples (id,name,split,createdAt,imageId,taskId) VALUES (@id,@name,@split,@createdAt,@imageId,@taskId)`
)

const CreateAnnotatorStatement = db.prepare<IStoredAnnotator>(
  `INSERT INTO annotators (id,name,url,headers,projectId) VALUES (@id,@name,@url,@headers,@projectId)`
)

const GetAnnotatorsStatement = db.prepare<[projectId: string], IStoredAnnotator>(
  `SELECT id,name,url,headers FROM annotators WHERE projectId = ? ORDER BY id ASC`
)

const DeleteAnnotatorStatement = db.prepare<[annotatorId: string]>(
  `DELETE FROM annotators WHERE id = ?`
)

const DeleteAnnotatorsTransaction = db.transaction((annotatorIds: string[]) => {
  for (const annotatorId of annotatorIds) {
    DeleteAnnotatorStatement.run(annotatorId)
  }
})

// const DeleteLabelStatement = db.prepare<INewLabel & { projectId: string }>(
//   `INSERT INTO labels (id,name) VALUES (@id,@name,@color,@createdAt,@projectId)`
// )

const DeleteTaskStatement = db.prepare<{
  id: ITask['id']
}>('DELETE FROM tasks WHERE id = @id')

const DeleteSampleStatement = db.prepare<{
  id: ISample['id']
}>('DELETE FROM samples WHERE id = @id')

const DeleteAnnotationStatement = db.prepare<{
  id: IAnnotation['id']
}>('DELETE FROM annotations WHERE id = @id')

const CreateAnnotationsTransaction = db.transaction(
  (sampleId: string, annotations: INewAnnotation[]): IAnnotation[] => {
    const result: IAnnotation[] = []

    annotations.forEach((annotation) => {
      CreateAnnotationStatement.run({
        id: annotation.id,
        type: annotation.type,
        labelId: annotation.labelId,
        sampleId: sampleId
      })

      // Insert points into the points table
      annotation.points.forEach((point, sequence) => {
        CreatePointStatement.run({
          id: point.id,
          x: point.x,
          y: point.y,
          sequence: sequence,
          annotationId: annotation.id
        })
      })

      result.push(annotation)
    })

    return result
  }
)

const CreateImagesTransaction = db.transaction((hashes: string[], extensions: string[]) => {
  const ids: string[] = []
  const inserted: Set<number> = new Set()

  for (let i = 0; i < hashes.length; i++) {
    const hash = hashes[i]
    const extension = extensions[i]
    const existing = GetImageByHashStatement.get(hash)
    if (existing !== undefined) {
      ids.push(existing.id)
    } else {
      inserted.add(i)
      const id = makeUUID()
      ids.push(id)
      CreateImageStatement.run({ id, hash, extension })
    }
  }

  return { ids, inserted }
})

const DeleteTasksTransaction = db.transaction((ids: string[]) => {
  for (const id of ids) {
    DeleteTaskStatement.run({ id: id })
  }
})

const DeleteSamplesTransaction = db.transaction((ids: string[]) => {
  for (const id of ids) {
    DeleteSampleStatement.run({ id: id })
  }
})

const DeleteAnnotationsTransaction = db.transaction((ids: string[]) => {
  for (const id of ids) {
    DeleteAnnotationStatement.run({ id: id })
  }
})

const ReplacePointsTransaction = db.transaction(
  (annotationId: string, points: IPointReplacement[]): IPoint[] => {
    // Get current points for the annotation
    const currentPoints = GetPointsStatement.all(annotationId)

    // Create a map of current points by id
    const currentPointsMap = new Map(currentPoints.map((p) => [p.id, p]))

    // Categorize operations
    const toInsert: DatabasePoint[] = []
    const toUpdate: DatabasePoint[] = []
    const toDelete: string[] = []

    // Process each input point
    for (let sequence = 0; sequence < points.length; sequence++) {
      const pointInput = points[sequence]
      const id = pointInput.id

      if (currentPointsMap.has(id)) {
        // Update existing point
        const existing = currentPointsMap.get(id)!
        toUpdate.push({
          id: id,
          x: pointInput.x ?? existing.x,
          y: pointInput.y ?? existing.y,
          sequence: sequence
        })
      } else {
        // Insert new point - must have x and y
        if (pointInput.x === undefined || pointInput.y === undefined) {
          throw new Error(`New point with id ${id} missing x or y coordinate`)
        }
        toInsert.push({
          id: id,
          x: pointInput.x,
          y: pointInput.y,
          sequence: sequence
        })
      }
    }

    // Points to delete: current points not in input
    for (const current of currentPoints) {
      const isInInput = points.some((p) => p.id === current.id)
      if (!isInInput) {
        toDelete.push(current.id)
      }
    }

    // Perform operations in order: delete, insert, update
    for (const id of toDelete) {
      DeletePointStatement.run(id)
    }

    for (const point of toInsert) {
      CreatePointStatement.run({
        id: point.id,
        x: point.x,
        y: point.y,
        sequence: point.sequence,
        annotationId: annotationId
      })
    }

    for (const point of toUpdate) {
      UpdatePointStatement.run({
        id: point.id,
        x: point.x,
        y: point.y,
        sequence: point.sequence
      })
    }

    // Return the full list of points ordered by sequence
    return GetPointsWithoutSequenceStatement.all(annotationId) as IPoint[]
  }
)

export const IMAGES_PROTOCOL_URL = 'images'

const makeImageUri = (id: string, extension: string) => {
  return `${IMAGES_PROTOCOL_URL}://${id}.${extension}`
}

export const getImagePathFromUrl = async (url: string) => {
  const imageKey = url.slice(IMAGES_PROTOCOL_URL.length + 3)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [id, _] = imageKey.split('.') as [string, string]
  const imageInfo = GetImageByIdStatement.get(id)

  if (imageInfo === undefined) {
    return undefined
  }

  return path.join(imagesPath, `${imageInfo.hash}.${imageInfo.extension}`)
}

const materializeSample = (s: IStoredSample): ISample => {
  const imageInfo = GetImageByIdStatement.get(s.imageId)
  if (imageInfo === undefined) throw new Error('Sample image does not exist')

  const annotations = GetAnnotationsStatement.all(s.id)

  return {
    id: s.id,
    name: s.name,
    annotations: annotations.map<IAnnotation>((a) => {
      const pointRows = GetPointsWithoutSequenceStatement.all(a.id)
      return {
        id: a.id,
        type: a.type,
        labelId: a.labelId,
        points: pointRows
      }
    }),
    createdAt: s.createdAt,
    split: s.split,
    imageUri: makeImageUri(imageInfo.id, imageInfo.extension),
    completedAt: s.completedAt ?? null
  }
}

const GetSamplesForTaskTransaction = db.transaction((taskId: string): ISample[] => {
  const samples = GetSampleStatement.all(taskId)
  return samples.map(materializeSample)
})

const GetSamplesByIdsTransaction = db.transaction((sampleIds: string[]): ISample[] => {
  const samples: ISample[] = []
  for (const sampleId of sampleIds) {
    const sample = GetSampleByIdStatement.get(sampleId)
    if (sample !== undefined) {
      samples.push(materializeSample(sample))
    }
  }
  return samples
})

const GetAnnotationsForSampleTransaction = db.transaction((sampleId: string): IAnnotation[] => {
  const annotations = GetAnnotationsStatement.all(sampleId)

  return annotations.map<IAnnotation>((annotation) => {
    const pointRows = GetPointsWithoutSequenceStatement.all(annotation.id)
    return {
      id: annotation.id,
      type: annotation.type,
      labelId: annotation.labelId,
      points: pointRows
    }
  })
})

const CreateSamplesTransaction = db.transaction(
  (taskId: string, samples: INewSample[], hashes: string[], extensions: string[]) => {
    const { ids: imageIds, inserted: insertedImagesIndex } = CreateImagesTransaction.immediate(
      hashes,
      extensions
    )

    const newSamples: ISample[] = []

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i]
      const imageId = imageIds[i]
      const imageExtension = extensions[i]
      CreateSampleStatement.run({ ...sample, taskId, imageId })

      newSamples.push({
        id: sample.id,
        name: sample.name,
        imageUri: makeImageUri(imageId, imageExtension),
        createdAt: sample.createdAt,
        annotations: CreateAnnotationsTransaction.immediate(sample.id, sample.annotations),
        split: sample.split,
        completedAt: null
      })
    }

    return { insertedImagesIndex, newSamples }
  }
)

const CreateTaskTransaction = db.transaction(
  (
    projectId: string,
    id: string,
    name: string,
    newSamples: INewSample[],
    hashes: string[],
    extensions: string[]
  ): ITask => {
    const task = { id, name }
    CreateTaskStatement.run({ ...task, projectId })

    if (newSamples.length > 0) {
      CreateSamplesTransaction.immediate(task.id, newSamples, hashes, extensions)
    }

    return task
  }
)

const localStore: IDataStore = {
  connect: async () => {},

  disconnect: async () => {},

  getProjects: async () => {
    const projects = GetProjectsStatement.all().map<IProject>((c) => ({
      ...c,
      labels: GetLabelsStatement.all({ projectId: c.id })
    }))
    return projects
  },

  createProject: async (id, name, labels) => {
    return CreateProjectTransaction.immediate(id, name, labels)
  },

  deleteProjects: async (projectIds) => {
    DeleteProjectsTransaction.immediate(projectIds)
    return projectIds.map(() => true)
  },

  getTasksForProject: async (projectId) => {
    return GetTasksStatement.all({ projectId })
  },

  createTask: async (projectId, id, name, newSamples = []) => {
    if (newSamples.length === 0) {
      return CreateTaskTransaction.immediate(projectId, id, name, [], [], [])
    }

    const b64Images = newSamples.map((c) => c.base64Image)
    const hashes = sha512(b64Images)
    const buffers = b64Images.map((c) => Buffer.from(c, 'base64'))
    const extensions = await Promise.all(
      buffers.map((buffer) =>
        sharp(buffer)
          .metadata()
          .then((c) => c.format)
      )
    )

    // Persist files first so DB writes can stay inside one sync transaction.
    await Promise.all(
      buffers.map((buffer, idx) =>
        fs.writeFile(path.join(imagesPath, `${hashes[idx]}.${extensions[idx]}`), buffer)
      )
    )

    return CreateTaskTransaction.immediate(projectId, id, name, newSamples, hashes, extensions)
  },

  deleteTasks: async (taskIds) => {
    DeleteTasksTransaction.immediate(taskIds)
    return taskIds.map(() => true)
  },
  getSamplesForTask: async (taskId) => {
    return GetSamplesForTaskTransaction.deferred(taskId)
  },
  getSamples: async (sampleIds) => {
    return GetSamplesByIdsTransaction.deferred(sampleIds)
  },
  createSamples: async (taskId, samples) => {
    const b64Images = samples.map((c) => c.base64Image)
    const hashes = sha512(b64Images)
    const buffers = b64Images.map((c) => Buffer.from(c, 'base64'))
    const extensions = await Promise.all(
      buffers.map((buffer) =>
        sharp(buffer)
          .metadata()
          .then((c) => c.format)
      )
    )

    const { insertedImagesIndex, newSamples } = CreateSamplesTransaction.immediate(
      taskId,
      samples,
      hashes,
      extensions
    )

    // Write images to disk
    await Promise.all(
      Array.from(insertedImagesIndex).map((idx) =>
        fs.writeFile(path.join(imagesPath, `${hashes[idx]}.${extensions[idx]}`), buffers[idx])
      )
    )

    return newSamples
  },

  deleteSamples: async (sampleIds) => {
    DeleteSamplesTransaction.immediate(sampleIds)
    return sampleIds.map(() => true)
  },

  getAnnotationsForSample: async (sampleId) => {
    return GetAnnotationsForSampleTransaction.deferred(sampleId)
  },

  createAnnotations: async (sampleId, annotations) => {
    return CreateAnnotationsTransaction.immediate(sampleId, annotations)
  },

  updateAnnotations: async (updates) => {
    const updatedAnnotations = db.transaction((annotationUpdates): IAnnotation[] => {
      const results: IAnnotation[] = []

      for (const update of annotationUpdates) {
        const existing = GetAnnotationByIdStatement.get(update.id)
        if (existing === undefined) {
          throw new Error(`annotation not found: ${update.id}`)
        }

        const nextType = update.type ?? existing.type
        const nextLabelId = update.labelId ?? existing.labelId

        UpdateAnnotationStatement.run({
          id: existing.id,
          type: nextType,
          labelId: nextLabelId
        })

        const points = GetPointsStatement.all(existing.id).map((point) => ({
          id: point.id,
          x: point.x,
          y: point.y
        }))

        results.push({
          id: existing.id,
          type: nextType,
          labelId: nextLabelId,
          points
        })
      }

      return results
    })

    return updatedAnnotations.immediate(updates)
  },

  deleteAnnotations: async (annotationsIds) => {
    DeleteAnnotationsTransaction.immediate(annotationsIds)
    return annotationsIds.map(() => true)
  },

  getAnnotators: async (projectId) => {
    return GetAnnotatorsStatement.all(projectId).map<IAnnotator>((c) => ({
      ...c,
      headers: JSON.parse(c.headers)
    }))
  },

  createAnnotator: async (projectId, id, name, url, headers) => {
    const newAnnotator = { id, name, url, headers }
    CreateAnnotatorStatement.run({
      ...newAnnotator,
      headers: JSON.stringify(newAnnotator.headers),
      projectId
    })
    return {
      ...newAnnotator
    }
  },

  deleteAnnotators: async (annotatorIds) => {
    DeleteAnnotatorsTransaction.immediate(annotatorIds)
    return annotatorIds.map(() => true)
  },

  replacePoints: async (annotationId, points) => {
    return ReplacePointsTransaction.immediate(annotationId, points)
  }
}

// named exports (bindings)
export const {
  connect,
  disconnect,
  getProjects,
  createProject,
  deleteProjects,
  getTasksForProject: getTasks,
  createTask,
  deleteTasks,
  getSamplesForTask,
  getSamples,
  createSamples,
  deleteSamples,
  getAnnotationsForSample,
  createAnnotations,
  updateAnnotations,
  deleteAnnotations,
  getAnnotators,
  createAnnotator,
  deleteAnnotators,
  replacePoints
} = localStore
