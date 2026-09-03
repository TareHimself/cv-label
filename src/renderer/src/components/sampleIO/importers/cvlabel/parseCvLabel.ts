import { AnnotationType, ILabel, INewAnnotation, INewSample, TrainingSplit } from '@shared/types'
import { makeUUID } from '@shared/utils'
import { randomHexColor } from '@shared/color'
import type { VirtualFile } from '../virtualFileSystem'
import { resolveImagePath } from '../writeToScratch'

export type CvLabelClass = {
  id: string
  name: string
  color?: string
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
  completedAt?: string | null
  imageFile: string
}

type ManifestTask = {
  id: string
  name: string
  samples: ManifestSample[]
}

type CvLabelManifest = {
  version: number
  labels: CvLabelClass[]
  tasks: ManifestTask[]
}

const isManifestSample = (value: unknown): value is ManifestSample => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.id === 'string' &&
    typeof obj.imageFile === 'string' &&
    Array.isArray(obj.annotations)
  )
}

const isManifestTask = (value: unknown): value is ManifestTask => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    Array.isArray(obj.samples) &&
    obj.samples.every(isManifestSample)
  )
}

const isCvLabelManifest = (value: unknown): value is CvLabelManifest => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    obj.version === 1 &&
    Array.isArray(obj.labels) &&
    Array.isArray(obj.tasks) &&
    obj.tasks.every(isManifestTask)
  )
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

/** Pairs a flat list of manifest samples with their image files - a missing image is kept as null and skipped later, rather than failing the whole import. */
export const findCvLabelPairs = (
  samples: ManifestSample[],
  dir: string,
  files: VirtualFile[]
): CvLabelPair[] => {
  const byPath = new Map(files.map((f) => [f.path, f] as const))
  return samples.map((sample) => ({
    sample,
    image: byPath.get(`${dir}${sample.imageFile}`) ?? null
  }))
}

/** Converts a flat sample list to real samples, one image at a time (see yoloDatasetToSamples). Every id is regenerated fresh so re-importing never collides with existing records; annotations with no label mapping are dropped. */
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
        createdAt: pair.sample.createdAt,
        completedAt: pair.sample.completedAt ?? null
      })
    }

    processed += 1
    onProgress?.(processed, pairs.length)
  }

  return samples
}

export type CvLabelTaskGroup = {
  name: string
  samples: INewSample[]
}

/** Converts every task in the archive separately, applying the same label mapping to each - for a multi-task import that keeps task boundaries. */
export const cvLabelManifestTasksToGroups = async (
  manifest: CvLabelManifest,
  dir: string,
  files: VirtualFile[],
  labelIdToProjectLabelId: Map<string, string | null>,
  scratchDir: string,
  onProgress?: (completed: number, total: number) => void
): Promise<CvLabelTaskGroup[]> => {
  const total = manifest.tasks.reduce((sum, task) => sum + task.samples.length, 0)
  let completedBefore = 0

  const groups: CvLabelTaskGroup[] = []
  for (const task of manifest.tasks) {
    const pairs = findCvLabelPairs(task.samples, dir, files)
    const samples = await cvLabelDatasetToSamples(pairs, labelIdToProjectLabelId, scratchDir, (c) =>
      onProgress?.(completedBefore + c, total)
    )
    completedBefore += task.samples.length
    groups.push({ name: task.name, samples })
  }

  return groups
}

export type CvLabelProjectTask = {
  id: string
  name: string
  samples: INewSample[]
}

/** Converts the whole archive into a brand-new project's shape - fresh ids throughout, label colors kept as exported. */
export const cvLabelManifestToNewProject = async (
  manifest: CvLabelManifest,
  dir: string,
  files: VirtualFile[],
  scratchDir: string,
  onProgress?: (completed: number, total: number) => void
): Promise<{ labels: ILabel[]; tasks: CvLabelProjectTask[] }> => {
  const labelIdMap = new Map(manifest.labels.map((label) => [label.id, makeUUID()]))
  const labels: ILabel[] = manifest.labels.map((label) => ({
    id: labelIdMap.get(label.id)!,
    name: label.name,
    color: label.color ?? randomHexColor()
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
          createdAt: manifestSample.createdAt,
          completedAt: manifestSample.completedAt ?? null
        })
      }

      processed += 1
      onProgress?.(processed, total)
    }

    tasks.push({ id: makeUUID(), name: task.name, samples })
  }

  return { labels, tasks }
}

export type { CvLabelManifest }
