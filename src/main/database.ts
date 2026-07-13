// Will be loaded in a worker thread, cant use any electron API's
import {
  AnnotationType,
  IAnnotation,
  IAnnotator,
  IDataStore,
  INewAnnotation,
  INewAnnotator,
  INewSample,
  IPoint,
  IProject,
  ISample,
  ITask,
  TrainingSplit
} from '../shared/types'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { and, asc, eq, inArray } from 'drizzle-orm'
import path from 'path'
import fs from 'fs/promises'
import sharp from 'sharp'
import { makeUUID } from '../shared/utils'
import assert from 'assert'
import { sha512 } from './utils_no_electron'
import * as schema from './schema'

console.log('Database loaded into worker', APP_PATH)
declare global {
  const APP_PATH: string
  const MIGRATIONS_PATH: string
}

assert(APP_PATH !== undefined, 'APP_PATH global was not defined')
assert(MIGRATIONS_PATH !== undefined, 'MIGRATIONS_PATH global was not defined')

const storePath = path.join(APP_PATH, 'store')
const databasePath = path.join(storePath, 'database', 'data.db')
const imagesPath = path.join(storePath, 'images')

await fs.mkdir(imagesPath, { recursive: true })
await fs.mkdir(path.dirname(databasePath), { recursive: true })

const sqlite = new Database(databasePath, { fileMustExist: false })

sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

const db = drizzle(sqlite, { schema })

migrate(db, { migrationsFolder: MIGRATIONS_PATH })

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export const IMAGES_PROTOCOL_URL = 'images'

const makeImageUri = (id: string, extension: string) => {
  return `${IMAGES_PROTOCOL_URL}://${id}.${extension}`
}

export const getImagePathFromUrl = async (url: string) => {
  const imageKey = url.slice(IMAGES_PROTOCOL_URL.length + 3)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [id, _] = imageKey.split('.') as [string, string]
  const imageInfo = db.select().from(schema.images).where(eq(schema.images.id, id)).get()

  if (imageInfo === undefined) {
    return undefined
  }

  return path.join(imagesPath, `${imageInfo.hash}.${imageInfo.extension}`)
}

function fetchSampleWithRelations(id: string) {
  return db.query.samples.findFirst({
    where: eq(schema.samples.id, id),
    with: {
      image: true,
      annotations: {
        orderBy: (annotations, { asc }) => [asc(annotations.id)],
        with: {
          points: {
            orderBy: (points, { asc }) => [asc(points.sequence)]
          }
        }
      }
    }
  })
}

// Row shape returned by the sample relational query above (id/image/annotations/points).
type SampleWithRelationsRow = NonNullable<Awaited<ReturnType<typeof fetchSampleWithRelations>>>

const mapSampleRow = (row: SampleWithRelationsRow): ISample => ({
  id: row.id,
  name: row.name,
  split: row.split as TrainingSplit,
  createdAt: row.createdAt,
  completedAt: row.completedAt,
  imageUri: makeImageUri(row.image.id, row.image.extension),
  annotations: row.annotations.map<IAnnotation>((a) => ({
    id: a.id,
    type: a.type as AnnotationType,
    labelId: a.labelId,
    points: a.points
  }))
})

const dedupeImages = (
  tx: Tx,
  hashes: string[],
  extensions: string[]
): { ids: string[]; inserted: Set<number> } => {
  const ids: string[] = []
  const inserted: Set<number> = new Set()

  for (let i = 0; i < hashes.length; i++) {
    const hash = hashes[i]
    const extension = extensions[i]
    const existing = tx.select().from(schema.images).where(eq(schema.images.hash, hash)).get()
    if (existing !== undefined) {
      ids.push(existing.id)
    } else {
      inserted.add(i)
      const id = makeUUID()
      ids.push(id)
      tx.insert(schema.images).values({ id, hash, extension }).run()
    }
  }

  return { ids, inserted }
}

const insertAnnotations = (
  tx: Tx,
  sampleId: string,
  annotations: INewAnnotation[]
): IAnnotation[] => {
  for (const annotation of annotations) {
    tx.insert(schema.annotations)
      .values({ id: annotation.id, type: annotation.type, labelId: annotation.labelId, sampleId })
      .run()

    if (annotation.points.length > 0) {
      tx.insert(schema.points)
        .values(
          annotation.points.map((point, sequence) => ({
            id: point.id,
            x: point.x,
            y: point.y,
            sequence,
            annotationId: annotation.id
          }))
        )
        .run()
    }
  }

  return annotations
}

const insertSamplesWithImages = (
  tx: Tx,
  taskId: string,
  samples: INewSample[],
  hashes: string[],
  extensions: string[]
): { insertedImagesIndex: Set<number>; newSamples: ISample[] } => {
  const { ids: imageIds, inserted: insertedImagesIndex } = dedupeImages(tx, hashes, extensions)

  const newSamples: ISample[] = []

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]
    const imageId = imageIds[i]
    const imageExtension = extensions[i]

    tx.insert(schema.samples)
      .values({
        id: sample.id,
        name: sample.name,
        split: sample.split,
        createdAt: sample.createdAt,
        imageId,
        taskId
      })
      .run()

    newSamples.push({
      id: sample.id,
      name: sample.name,
      imageUri: makeImageUri(imageId, imageExtension),
      createdAt: sample.createdAt,
      annotations: insertAnnotations(tx, sample.id, sample.annotations),
      split: sample.split,
      completedAt: null
    })
  }

  return { insertedImagesIndex, newSamples }
}

const localStore: IDataStore = {
  connect: async () => {},

  disconnect: async () => {},

  getProjects: async () => {
    const projects = await db.query.projects.findMany({
      orderBy: (projects, { asc }) => [asc(projects.id)],
      with: {
        labels: {
          orderBy: (labels, { asc }) => [asc(labels.id)]
        }
      }
    })

    return projects.map<IProject>((p) => ({
      id: p.id,
      name: p.name,
      labels: p.labels
    }))
  },

  createProject: async (id, name, labels) => {
    return db.transaction((tx) => {
      tx.insert(schema.projects).values({ id, name }).run()

      if (labels.length > 0) {
        tx.insert(schema.labels)
          .values(labels.map((label) => ({ ...label, projectId: id })))
          .run()
      }

      return { id, name, labels }
    })
  },

  updateProjects: async (updates) => {
    return db.transaction((tx) => {
      return updates.map((update) => {
        if (update.name !== undefined) {
          tx.update(schema.projects)
            .set({ name: update.name })
            .where(eq(schema.projects.id, update.id))
            .run()
        }

        for (const label of update.labels ?? []) {
          // Scoped to projectId as a defensive check - the renderer only ever sends a project's
          // own labels back, but this keeps a bad id from silently renaming a label in another project.
          tx.update(schema.labels)
            .set({ name: label.name })
            .where(and(eq(schema.labels.id, label.id), eq(schema.labels.projectId, update.id)))
            .run()
        }

        const project = tx.query.projects
          .findFirst({
            where: eq(schema.projects.id, update.id),
            with: { labels: { orderBy: (labels, { asc }) => [asc(labels.id)] } }
          })
          .sync()

        if (project === undefined) {
          throw new Error(`project not found: ${update.id}`)
        }

        return project
      })
    })
  },

  deleteProjects: async (projectIds) => {
    db.transaction((tx) => {
      for (const id of projectIds) {
        tx.delete(schema.projects).where(eq(schema.projects.id, id)).run()
      }
    })
    return projectIds.map(() => true)
  },

  getTasksForProject: async (projectId) => {
    return db
      .select({ id: schema.tasks.id, name: schema.tasks.name })
      .from(schema.tasks)
      .where(eq(schema.tasks.projectId, projectId))
      .orderBy(asc(schema.tasks.id))
  },

  updateTasks: async (updates) => {
    return db.transaction((tx) => {
      return updates.map((update) => {
        if (update.name !== undefined) {
          tx.update(schema.tasks)
            .set({ name: update.name })
            .where(eq(schema.tasks.id, update.id))
            .run()
        }

        const task = tx
          .select({ id: schema.tasks.id, name: schema.tasks.name })
          .from(schema.tasks)
          .where(eq(schema.tasks.id, update.id))
          .get()

        if (task === undefined) {
          throw new Error(`task not found: ${update.id}`)
        }

        return task
      })
    })
  },

  createTask: async (projectId, id, name, newSamples = []) => {
    const task: ITask = { id, name }

    if (newSamples.length === 0) {
      db.transaction((tx) => {
        tx.insert(schema.tasks)
          .values({ ...task, projectId })
          .run()
      })
      return task
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

    db.transaction((tx) => {
      tx.insert(schema.tasks)
        .values({ ...task, projectId })
        .run()
      insertSamplesWithImages(tx, task.id, newSamples, hashes, extensions as string[])
    })

    return task
  },

  deleteTasks: async (taskIds) => {
    db.transaction((tx) => {
      for (const id of taskIds) {
        tx.delete(schema.tasks).where(eq(schema.tasks.id, id)).run()
      }
    })
    return taskIds.map(() => true)
  },

  getSamplesForTask: async (taskId) => {
    const samples = await db.query.samples.findMany({
      where: eq(schema.samples.taskId, taskId),
      orderBy: (samples, { asc }) => [asc(samples.id)],
      with: {
        image: true,
        annotations: {
          orderBy: (annotations, { asc }) => [asc(annotations.id)],
          with: {
            points: {
              orderBy: (points, { asc }) => [asc(points.sequence)]
            }
          }
        }
      }
    })

    return samples.map(mapSampleRow)
  },

  getSamples: async (sampleIds) => {
    const samples: ISample[] = []
    for (const sampleId of sampleIds) {
      const sample = await fetchSampleWithRelations(sampleId)
      if (sample !== undefined) {
        samples.push(mapSampleRow(sample))
      }
    }
    return samples
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

    const { insertedImagesIndex, newSamples } = db.transaction((tx) =>
      insertSamplesWithImages(tx, taskId, samples, hashes, extensions as string[])
    )

    // Write images to disk
    await Promise.all(
      Array.from(insertedImagesIndex).map((idx) =>
        fs.writeFile(path.join(imagesPath, `${hashes[idx]}.${extensions[idx]}`), buffers[idx])
      )
    )

    return newSamples
  },

  updateSamples: async (updates) => {
    return db.transaction((tx) => {
      const updatedSamples: ISample[] = []

      for (const update of updates) {
        const existingRow = tx.query.samples
          .findFirst({
            where: eq(schema.samples.id, update.id),
            with: {
              image: true,
              annotations: {
                orderBy: (annotations, { asc }) => [asc(annotations.id)],
                with: {
                  points: {
                    orderBy: (points, { asc }) => [asc(points.sequence)]
                  }
                }
              }
            }
          })
          .sync()

        if (existingRow === undefined) {
          throw new Error(`sample not found: ${update.id}`)
        }

        const existingSample = mapSampleRow(existingRow)

        tx.update(schema.samples)
          .set({
            name: update.name ?? existingRow.name,
            split: update.split ?? existingRow.split,
            createdAt: update.createdAt ?? existingRow.createdAt,
            completedAt: update.completedAt ?? existingRow.completedAt
          })
          .where(eq(schema.samples.id, update.id))
          .run()

        updatedSamples.push({
          ...existingSample,
          name: update.name ?? existingSample.name,
          split: update.split ?? existingSample.split,
          createdAt: update.createdAt ?? existingSample.createdAt,
          completedAt: update.completedAt ?? existingSample.completedAt
        })
      }

      return updatedSamples
    })
  },

  deleteSamples: async (sampleIds) => {
    db.transaction((tx) => {
      for (const id of sampleIds) {
        tx.delete(schema.samples).where(eq(schema.samples.id, id)).run()
      }
    })
    return sampleIds.map(() => true)
  },

  getAnnotationsForSample: async (sampleId) => {
    const annotations = await db.query.annotations.findMany({
      where: eq(schema.annotations.sampleId, sampleId),
      orderBy: (annotations, { asc }) => [asc(annotations.id)],
      with: {
        points: {
          orderBy: (points, { asc }) => [asc(points.sequence)]
        }
      }
    })

    return annotations.map<IAnnotation>((annotation) => ({
      id: annotation.id,
      type: annotation.type as AnnotationType,
      labelId: annotation.labelId,
      points: annotation.points
    }))
  },

  createAnnotations: async (sampleId, annotations) => {
    return db.transaction((tx) => insertAnnotations(tx, sampleId, annotations))
  },

  updateAnnotations: async (updates) => {
    return db.transaction((tx) => {
      const results: IAnnotation[] = []

      for (const update of updates) {
        const existing = tx
          .select()
          .from(schema.annotations)
          .where(eq(schema.annotations.id, update.id))
          .get()

        if (existing === undefined) {
          throw new Error(`annotation not found: ${update.id}`)
        }

        const nextType = update.type ?? (existing.type as AnnotationType)
        const nextLabelId = update.labelId ?? existing.labelId

        tx.update(schema.annotations)
          .set({ type: nextType, labelId: nextLabelId })
          .where(eq(schema.annotations.id, existing.id))
          .run()

        const points = tx
          .select({ id: schema.points.id, x: schema.points.x, y: schema.points.y })
          .from(schema.points)
          .where(eq(schema.points.annotationId, existing.id))
          .orderBy(asc(schema.points.sequence))
          .all()

        results.push({
          id: existing.id,
          type: nextType,
          labelId: nextLabelId,
          points
        })
      }

      return results
    })
  },

  deleteAnnotations: async (annotationsIds) => {
    db.transaction((tx) => {
      for (const id of annotationsIds) {
        tx.delete(schema.annotations).where(eq(schema.annotations.id, id)).run()
      }
    })
    return annotationsIds.map(() => true)
  },

  getAnnotators: async (projectId) => {
    const annotators = await db
      .select({
        id: schema.annotators.id,
        name: schema.annotators.name,
        url: schema.annotators.url,
        headers: schema.annotators.headers
      })
      .from(schema.annotators)
      .where(eq(schema.annotators.projectId, projectId))
      .orderBy(asc(schema.annotators.id))

    return annotators.map<IAnnotator>((a) => ({
      ...a,
      headers: JSON.parse(a.headers)
    }))
  },

  createAnnotator: async (projectId, id, name, url, headers) => {
    const newAnnotator: INewAnnotator = { id, name, url, headers }
    db.insert(schema.annotators)
      .values({ ...newAnnotator, headers: JSON.stringify(newAnnotator.headers), projectId })
      .run()
    return { ...newAnnotator }
  },

  deleteAnnotators: async (annotatorIds) => {
    db.transaction((tx) => {
      for (const id of annotatorIds) {
        tx.delete(schema.annotators).where(eq(schema.annotators.id, id)).run()
      }
    })
    return annotatorIds.map(() => true)
  },

  replacePoints: async (annotationId, points) => {
    return db.transaction((tx) => {
      // Get current points for the annotation
      const currentPoints = tx
        .select({
          id: schema.points.id,
          x: schema.points.x,
          y: schema.points.y,
          sequence: schema.points.sequence
        })
        .from(schema.points)
        .where(eq(schema.points.annotationId, annotationId))
        .orderBy(asc(schema.points.sequence))
        .all()

      // Create a map of current points by id
      const currentPointsMap = new Map(currentPoints.map((p) => [p.id, p]))

      // Categorize operations
      const toInsert: { id: string; x: number; y: number; sequence: number }[] = []
      const toUpdate: { id: string; x: number; y: number; sequence: number }[] = []
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
      if (toDelete.length > 0) {
        tx.delete(schema.points).where(inArray(schema.points.id, toDelete)).run()
      }

      if (toInsert.length > 0) {
        tx.insert(schema.points)
          .values(toInsert.map((point) => ({ ...point, annotationId })))
          .run()
      }

      for (const point of toUpdate) {
        tx.update(schema.points)
          .set({ x: point.x, y: point.y, sequence: point.sequence })
          .where(eq(schema.points.id, point.id))
          .run()
      }

      // Return the full list of points ordered by sequence
      return tx
        .select({ id: schema.points.id, x: schema.points.x, y: schema.points.y })
        .from(schema.points)
        .where(eq(schema.points.annotationId, annotationId))
        .orderBy(asc(schema.points.sequence))
        .all() as IPoint[]
    })
  }
}

// named exports (bindings)
export const {
  connect,
  disconnect,
  getProjects,
  createProject,
  updateProjects,
  deleteProjects,
  getTasksForProject: getTasks,
  createTask,
  updateTasks,
  deleteTasks,
  getSamplesForTask,
  getSamples,
  createSamples,
  updateSamples,
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
