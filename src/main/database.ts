// Will be loaded in a worker thread, cant use any electron API's
import {
  AnnotationType,
  ArchiveManifest,
  IAnnotation,
  IDataStore,
  INewAnnotation,
  INewSample,
  IPoint,
  IProject,
  ISample,
  ITag,
  ITask,
  LOCAL_STORE_ID,
  TrainingSplit
} from '../shared/types'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { and, asc, count, eq, inArray } from 'drizzle-orm'
import path from 'path'
import fs from 'fs/promises'
import { createReadStream, createWriteStream } from 'fs'
import type { Readable } from 'node:stream'
import archiver from 'archiver'
import sharp from 'sharp'
import { makeUUID } from '../shared/utils'
import { mapWithConcurrency } from '../shared/concurrency'
import assert from 'assert'
import { hashFile } from './utils_no_electron'
import * as schema from './schema'

console.log('Database loaded into worker', APP_PATH)

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

const makeImageUri = (id: string, extension: string) => {
  return `image://${LOCAL_STORE_ID}/${id}.${extension}`
}

/** Takes just the `<id>.<ext>` segment (the image:// URL's pathname, minus the leading
 *  slash) - the storeId/scheme parsing happens once, centrally, in the orchestrator's
 *  protocol.handle before this store is ever consulted. */
export const getImagePathForId = async (idWithExtension: string) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [id, _] = idWithExtension.split('.') as [string, string]
  const imageInfo = db.select().from(schema.images).where(eq(schema.images.id, id)).get()

  if (imageInfo === undefined) {
    return undefined
  }

  return path.join(imagesPath, `${imageInfo.hash}.${imageInfo.extension}`)
}

/** A Node Readable can't cross the worker_threads postMessage boundary, so unlike every
 *  other export here this is never called through the RPC proxy from main - only from
 *  exportSamplesToArchive, in the same worker module. A future non-local IDataStore
 *  implementation would swap this for e.g. an HTTP GET response stream; nothing that
 *  consumes it needs to know which. */
export const getImageStream = async (imageUri: string) => {
  const filePath = await getImagePathForId(new URL(imageUri).pathname.slice(1))
  return filePath === undefined ? undefined : createReadStream(filePath)
}

// How many image entries can be mid-append (file open, being read/compressed/written) at
// once. archive.append() only queues an entry and returns immediately, so appending every
// entry back to back with no bound would open one file descriptor per image up front -
// fine for a handful of samples, but risks exhausting file descriptors (EMFILE) on
// datasets with thousands of images. This bounds that to a fixed window instead of either
// extreme (unbounded, or strictly one-at-a-time).
const DEFAULT_EXPORT_CONCURRENCY = 10

export const exportSamplesToArchive = async (
  destinationPath: string,
  manifest: ArchiveManifest,
  concurrency: number = DEFAULT_EXPORT_CONCURRENCY,
  // Must stay the last parameter: the worker-RPC layer detects a trailing function
  // argument as an out-of-band progress callback (see main/worker/index.ts) and strips it
  // before the call crosses into the worker.
  onProgress?: (completed: number, total: number) => void
): Promise<void> => {
  const archive = archiver('zip', { zlib: { level: 9 } })
  const output = createWriteStream(destinationPath)

  const done = new Promise<void>((resolve, reject) => {
    output.on('close', resolve)
    output.on('error', reject)
    archive.on('error', reject)
  })

  archive.pipe(output)

  // Progress is tracked against the manifest's own (fixed, known-upfront) entry count
  // rather than archiver's own 'progress' event, which only reflects entries queued so far
  // and would understate the real dataset size while entries are still being appended.
  const total = manifest.textEntries.length + manifest.imageEntries.length
  let completed = 0

  // With several appends in flight at once, archiver's 'entry' event (fired per completed
  // entry) can't be matched to the right pending promise by registration order - a single
  // persistent listener correlates each event to its own append by name instead.
  const pendingByName = new Map<string, () => void>()
  archive.on('entry', (entryData) => {
    const resolve = pendingByName.get(entryData.name)
    if (resolve === undefined) return
    pendingByName.delete(entryData.name)
    completed += 1
    onProgress?.(completed, total)
    resolve()
  })

  const appendAndWaitForEntry = (source: string | Readable, name: string): Promise<void> =>
    new Promise((resolve) => {
      pendingByName.set(name, resolve)
      archive.append(source, { name })
    })

  for (const entry of manifest.textEntries) {
    await appendAndWaitForEntry(entry.content, entry.path)
  }

  await mapWithConcurrency(manifest.imageEntries, concurrency, async (entry) => {
    const stream = await getImageStream(entry.imageUri)
    if (stream !== undefined) {
      await appendAndWaitForEntry(stream, entry.path)
    }
  })

  await archive.finalize()
  await done
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

/** Images written before the width/height columns existed have them as null - backfill
 *  lazily on first read rather than a blocking startup migration over every existing file. */
const imageDimensions = async (
  image: SampleWithRelationsRow['image']
): Promise<{ width: number; height: number }> => {
  if (image.width !== null && image.height !== null) {
    return { width: image.width, height: image.height }
  }

  try {
    const imagePath = path.join(imagesPath, `${image.hash}.${image.extension}`)
    const metadata = await sharp(imagePath).metadata()
    const width = metadata.width ?? 0
    const height = metadata.height ?? 0
    db.update(schema.images).set({ width, height }).where(eq(schema.images.id, image.id)).run()
    return { width, height }
  } catch (error) {
    console.error('Failed to backfill image dimensions', error)
    return { width: 0, height: 0 }
  }
}

const mapSampleRow = async (row: SampleWithRelationsRow): Promise<ISample> => {
  const { width, height } = await imageDimensions(row.image)

  return {
    id: row.id,
    name: row.name,
    split: row.split as TrainingSplit,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    imageUri: makeImageUri(row.image.id, row.image.extension),
    width,
    height,
    annotations: row.annotations.map<IAnnotation>((a) => ({
      id: a.id,
      type: a.type as AnnotationType,
      labelId: a.labelId,
      points: a.points
    }))
  }
}

type ImageMetadata = { hash: string; extension: string; width: number; height: number }

// Bounds in-flight file handles/hashes during ingestion instead of processing a whole
// import batch (which can run into the thousands of images) at once.
const INGEST_CONCURRENCY = 8

const ingestScratchImage = async (imagePath: string): Promise<ImageMetadata> => {
  const [hash, metadata] = await Promise.all([hashFile(imagePath), sharp(imagePath).metadata()])
  return {
    hash,
    extension: metadata.format as string,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0
  }
}

/** Moves a scratch file into the store, falling back to copy+unlink when the scratch
 *  directory (os.tmpdir()) isn't on the same filesystem/drive as the store - fs.rename
 *  throws EXDEV in that case rather than silently failing, so this must not be skipped. */
const moveOrCopyFile = async (source: string, destination: string): Promise<void> => {
  try {
    await fs.rename(source, destination)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
      await fs.copyFile(source, destination)
      await fs.unlink(source)
    } else {
      throw error
    }
  }
}

/** Consumes every scratch file referenced by samples: moves the ones behind a newly
 *  inserted image into the store, and discards the rest (their content is already
 *  covered by an existing store file, per insertedImagesIndex). */
const consumeScratchFiles = async (
  samples: INewSample[],
  images: ImageMetadata[],
  insertedImagesIndex: Set<number>
): Promise<void> => {
  await mapWithConcurrency(samples, INGEST_CONCURRENCY, async (sample, idx) => {
    if (insertedImagesIndex.has(idx)) {
      const { hash, extension } = images[idx]
      await moveOrCopyFile(sample.imagePath, path.join(imagesPath, `${hash}.${extension}`))
    } else {
      await fs.unlink(sample.imagePath)
    }
  })
}

const dedupeImages = (
  tx: Tx,
  images: ImageMetadata[]
): { ids: string[]; inserted: Set<number> } => {
  const ids: string[] = []
  const inserted: Set<number> = new Set()

  for (let i = 0; i < images.length; i++) {
    const { hash, extension, width, height } = images[i]
    const existing = tx.select().from(schema.images).where(eq(schema.images.hash, hash)).get()
    if (existing !== undefined) {
      ids.push(existing.id)
    } else {
      inserted.add(i)
      const id = makeUUID()
      ids.push(id)
      tx.insert(schema.images).values({ id, hash, extension, width, height }).run()
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
  images: ImageMetadata[]
): { insertedImagesIndex: Set<number>; newSamples: ISample[] } => {
  const { ids: imageIds, inserted: insertedImagesIndex } = dedupeImages(tx, images)

  const newSamples: ISample[] = []

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]
    const imageId = imageIds[i]
    const { extension, width, height } = images[i]

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
      imageUri: makeImageUri(imageId, extension),
      width,
      height,
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
          const result = tx
            .update(schema.labels)
            .set({ name: label.name, color: label.color })
            .where(and(eq(schema.labels.id, label.id), eq(schema.labels.projectId, update.id)))
            .run()

          // A label id the project doesn't have yet isn't a rename - it's a new label
          // being added (EditProjectModal's "Add Label"), so insert it instead.
          if (result.changes === 0) {
            tx.insert(schema.labels)
              .values({ id: label.id, name: label.name, color: label.color, projectId: update.id })
              .run()
          }
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
    // count(samples.id) skips the null produced by the left join for a task with no
    // samples yet; count(samples.completedAt) counts only the non-null (completed) ones -
    // both fall out of plain SQL COUNT-of-a-column semantics, no CASE/filter needed.
    const taskRows = await db
      .select({
        id: schema.tasks.id,
        name: schema.tasks.name,
        sampleCount: count(schema.samples.id),
        completedSampleCount: count(schema.samples.completedAt)
      })
      .from(schema.tasks)
      .leftJoin(schema.samples, eq(schema.samples.taskId, schema.tasks.id))
      .where(eq(schema.tasks.projectId, projectId))
      .groupBy(schema.tasks.id)
      .orderBy(asc(schema.tasks.id))

    if (taskRows.length === 0) {
      return []
    }

    // A second, separate query rather than joining task_tags into the query above - that
    // aggregate already GROUPs by task for the sample counts, and a many-to-many tags join
    // would multiply rows before the GROUP BY and corrupt those counts.
    const tagRows = await db
      .select({
        taskId: schema.taskTags.taskId,
        id: schema.tags.id,
        name: schema.tags.name
      })
      .from(schema.taskTags)
      .innerJoin(schema.tags, eq(schema.taskTags.tagId, schema.tags.id))
      .where(
        inArray(
          schema.taskTags.taskId,
          taskRows.map((t) => t.id)
        )
      )

    const tagsByTaskId = new Map<string, ITag[]>()
    for (const row of tagRows) {
      const list = tagsByTaskId.get(row.taskId) ?? []
      list.push({ id: row.id, name: row.name })
      tagsByTaskId.set(row.taskId, list)
    }

    return taskRows.map((task) => ({ ...task, tags: tagsByTaskId.get(task.id) ?? [] }))
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
    // Newly created samples never carry a completedAt (INewSample has no such field -
    // see cvLabelDatasetToSamples etc.), so completedSampleCount is always 0 here -
    // cheaper than an extra aggregate query for a value we already know. A new task
    // starts untagged.
    const task: ITask = {
      id,
      name,
      sampleCount: newSamples.length,
      completedSampleCount: 0,
      tags: []
    }

    if (newSamples.length === 0) {
      db.transaction((tx) => {
        tx.insert(schema.tasks).values({ id, name, projectId }).run()
      })
      return task
    }

    const images = await mapWithConcurrency(
      newSamples.map((s) => s.imagePath),
      INGEST_CONCURRENCY,
      ingestScratchImage
    )

    const { insertedImagesIndex } = db.transaction((tx) => {
      tx.insert(schema.tasks).values({ id, name, projectId }).run()
      return insertSamplesWithImages(tx, task.id, newSamples, images)
    })

    await consumeScratchFiles(newSamples, images, insertedImagesIndex)

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

  getTagsForProject: async (projectId) => {
    return db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.projectId, projectId))
      .orderBy(asc(schema.tags.name))
  },

  createTag: async (projectId, id, name) => {
    db.insert(schema.tags).values({ id, name, projectId }).run()
    return { id, name }
  },

  updateTags: async (updates) => {
    return db.transaction((tx) => {
      return updates.map((update) => {
        if (update.name !== undefined) {
          tx.update(schema.tags)
            .set({ name: update.name })
            .where(eq(schema.tags.id, update.id))
            .run()
        }

        const tag = tx
          .select({ id: schema.tags.id, name: schema.tags.name })
          .from(schema.tags)
          .where(eq(schema.tags.id, update.id))
          .get()

        if (tag === undefined) {
          throw new Error(`tag not found: ${update.id}`)
        }

        return tag
      })
    })
  },

  deleteTags: async (tagIds) => {
    db.transaction((tx) => {
      for (const id of tagIds) {
        tx.delete(schema.tags).where(eq(schema.tags.id, id)).run()
      }
    })
    return tagIds.map(() => true)
  },

  addTagsToTasks: async (taskIds, tagIds) => {
    if (taskIds.length === 0 || tagIds.length === 0) return

    db.transaction((tx) => {
      for (const taskId of taskIds) {
        for (const tagId of tagIds) {
          tx.insert(schema.taskTags).values({ taskId, tagId }).onConflictDoNothing().run()
        }
      }
    })
  },

  removeTagsFromTasks: async (taskIds, tagIds) => {
    if (taskIds.length === 0 || tagIds.length === 0) return

    db.transaction((tx) => {
      tx.delete(schema.taskTags)
        .where(
          and(inArray(schema.taskTags.taskId, taskIds), inArray(schema.taskTags.tagId, tagIds))
        )
        .run()
    })
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

    return Promise.all(samples.map(mapSampleRow))
  },

  getSamples: async (sampleIds) => {
    const samples: ISample[] = []
    for (const sampleId of sampleIds) {
      const sample = await fetchSampleWithRelations(sampleId)
      if (sample !== undefined) {
        samples.push(await mapSampleRow(sample))
      }
    }
    return samples
  },

  createSamples: async (taskId, samples) => {
    const images = await mapWithConcurrency(
      samples.map((s) => s.imagePath),
      INGEST_CONCURRENCY,
      ingestScratchImage
    )

    const { insertedImagesIndex, newSamples } = db.transaction((tx) =>
      insertSamplesWithImages(tx, taskId, samples, images)
    )

    await consumeScratchFiles(samples, images, insertedImagesIndex)

    return newSamples
  },

  updateSamples: async (updates) => {
    // Read rows and resolve (possibly-backfilled) width/height before the transaction,
    // since better-sqlite3 transactions run synchronously and sharp's metadata read doesn't.
    const existingRows = updates.map((update) => {
      const row = db.query.samples
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

      if (row === undefined) {
        throw new Error(`sample not found: ${update.id}`)
      }

      return row
    })

    const existingSamples = await Promise.all(existingRows.map(mapSampleRow))

    return db.transaction((tx) => {
      const updatedSamples: ISample[] = []

      for (let i = 0; i < updates.length; i++) {
        const update = updates[i]
        const existingRow = existingRows[i]
        const existingSample = existingSamples[i]

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
  getTasksForProject,
  createTask,
  updateTasks,
  deleteTasks,
  getTagsForProject,
  createTag,
  updateTags,
  deleteTags,
  addTagsToTasks,
  removeTagsFromTasks,
  getSamplesForTask,
  getSamples,
  createSamples,
  updateSamples,
  deleteSamples,
  getAnnotationsForSample,
  createAnnotations,
  updateAnnotations,
  deleteAnnotations,
  replacePoints
} = localStore
