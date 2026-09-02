import { AnnotationType, ILabel, INewAnnotation, INewSample, TrainingSplit } from '@shared/types'
import { makeUUID } from '@shared/utils'
import { randomHexColor } from '@shared/color'
import type { VirtualFile } from '../virtualFileSystem'
import { resolveImagePath } from '../writeToScratch'

export type CvLabelClass = {
  id: string
  name: string
}

type ManifestAnnotation = {
  id: string
  type: AnnotationType
  labelId: string
  points: { id: string; x: number; y: number }[]
}

type ManifestSample = {
  id: string
  name: string
  split: TrainingSplit
  annotations: ManifestAnnotation[]
  createdAt: string
  imageFile: string
}

type ManifestTask = {
  id: string
  name: string
  samples: ManifestSample[]
}

type CvLabelTasksManifest = {
  version: number
  kind: 'tasks'
  labels: CvLabelClass[]
  samples: ManifestSample[]
}

type CvLabelProjectManifest = {
  version: number
  kind: 'project'
  project: { name: string }
  labels: CvLabelClass[]
  tasks: ManifestTask[]
}

type CvLabelManifest = CvLabelTasksManifest | CvLabelProjectManifest

const isManifestSample = (value: unknown): value is ManifestSample => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.id === 'string' &&
    typeof obj.imageFile === 'string' &&
    Array.isArray(obj.annotations)
  )
}

const isCvLabelManifest = (value: unknown): value is CvLabelManifest => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (obj.version !== 1 || !Array.isArray(obj.labels)) return false

  if (obj.kind === 'tasks') {
    return Array.isArray(obj.samples) && obj.samples.every(isManifestSample)
  }

  if (obj.kind === 'project') {
    return (
      typeof obj.project === 'object' &&
      obj.project !== null &&
      typeof (obj.project as Record<string, unknown>).name === 'string' &&
      Array.isArray(obj.tasks) &&
      obj.tasks.every(
        (task) =>
          typeof task === 'object' &&
          task !== null &&
          typeof (task as Record<string, unknown>).id === 'string' &&
          typeof (task as Record<string, unknown>).name === 'string' &&
          Array.isArray((task as Record<string, unknown>).samples) &&
          ((task as Record<string, unknown>).samples as unknown[]).every(isManifestSample)
      )
    )
  }

  return false
}

const dirOf = (path: string) => {
  const idx = path.lastIndexOf('/')
  return idx === -1 ? '' : path.slice(0, idx + 1)
}

/** Reads this app's own .cvlabel export - a manifest.json plus referenced images. `dir` is manifest.json's own folder, since `imageFile` paths are relative to it. Null if no valid manifest is found. */
export const findCvLabelManifest = async (
  files: VirtualFile[]
): Promise<{ manifest: CvLabelManifest; dir: string } | null> => {
  const manifestFile = files.find((f) => /(^|\/)manifest\.json$/i.test(f.path))
  if (!manifestFile) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(await manifestFile.text())
  } catch {
    return null
  }
  if (!isCvLabelManifest(parsed)) return null

  return { manifest: parsed, dir: dirOf(manifestFile.path) }
}

export type CvLabelPair = {
  sample: ManifestSample
  image: VirtualFile | null
}

/** Pairs a `kind: "tasks"` manifest's samples with their image files - a missing image is kept as null and skipped later, rather than failing the whole import. */
export const findCvLabelPairs = (
  manifest: CvLabelTasksManifest,
  dir: string,
  files: VirtualFile[]
): CvLabelPair[] => {
  const byPath = new Map(files.map((f) => [f.path, f] as const))
  return manifest.samples.map((sample) => ({
    sample,
    image: byPath.get(`${dir}${sample.imageFile}`) ?? null
  }))
}

/** Converts a `kind: "tasks"` archive to samples, one image at a time (see yoloDatasetToSamples). Every id is regenerated fresh so re-importing never collides with existing records; annotations with no label mapping are dropped. */
export const cvLabelDatasetToSamples = async (
  pairs: CvLabelPair[],
  labelIdToProjectLabelId: Map<string, string | null>,
  scratchDir: string,
  onProgress?: (completed: number, total: number) => void
): Promise<INewSample[]> => {
  const samples: INewSample[] = []
  let processed = 0

  for (const pair of pairs) {
    if (pair.image) {
      const imagePath = await resolveImagePath(pair.image, scratchDir)

      const annotations: INewAnnotation[] = []
      for (const annotation of pair.sample.annotations) {
        const labelId = labelIdToProjectLabelId.get(annotation.labelId)
        if (labelId === undefined || labelId === null) continue
        annotations.push({
          id: makeUUID(),
          type: annotation.type,
          labelId,
          points: annotation.points.map((p) => ({ id: makeUUID(), x: p.x, y: p.y }))
        })
      }

      samples.push({
        id: makeUUID(),
        name: pair.sample.name,
        imagePath,
        split: pair.sample.split,
        annotations,
        createdAt: pair.sample.createdAt
      })
    }

    processed += 1
    onProgress?.(processed, pairs.length)
  }

  return samples
}

export type CvLabelProjectTask = {
  id: string
  name: string
  samples: INewSample[]
}

/** Converts a `kind: "project"` archive into a brand-new project's shape - fresh ids and label colors throughout. */
export const cvLabelProjectManifestToNewProject = async (
  manifest: CvLabelProjectManifest,
  dir: string,
  files: VirtualFile[],
  scratchDir: string,
  onProgress?: (completed: number, total: number) => void
): Promise<{ labels: ILabel[]; tasks: CvLabelProjectTask[] }> => {
  const labelIdMap = new Map(manifest.labels.map((label) => [label.id, makeUUID()]))
  const labels: ILabel[] = manifest.labels.map((label) => ({
    id: labelIdMap.get(label.id)!,
    name: label.name,
    color: randomHexColor()
  }))

  const byPath = new Map(files.map((f) => [f.path, f] as const))
  const total = manifest.tasks.reduce((sum, task) => sum + task.samples.length, 0)
  let processed = 0

  const tasks: CvLabelProjectTask[] = []
  for (const task of manifest.tasks) {
    const samples: INewSample[] = []

    for (const manifestSample of task.samples) {
      const image = byPath.get(`${dir}${manifestSample.imageFile}`)
      if (image) {
        const imagePath = await resolveImagePath(image, scratchDir)
        const annotations: INewAnnotation[] = []
        for (const annotation of manifestSample.annotations) {
          const labelId = labelIdMap.get(annotation.labelId)
          if (labelId === undefined) continue
          annotations.push({
            id: makeUUID(),
            type: annotation.type,
            labelId,
            points: annotation.points.map((p) => ({ id: makeUUID(), x: p.x, y: p.y }))
          })
        }

        samples.push({
          id: makeUUID(),
          name: manifestSample.name,
          imagePath,
          split: manifestSample.split,
          annotations,
          createdAt: manifestSample.createdAt
        })
      }

      processed += 1
      onProgress?.(processed, total)
    }

    tasks.push({ id: makeUUID(), name: task.name, samples })
  }

  return { labels, tasks }
}

export type { CvLabelManifest, CvLabelTasksManifest, CvLabelProjectManifest }
