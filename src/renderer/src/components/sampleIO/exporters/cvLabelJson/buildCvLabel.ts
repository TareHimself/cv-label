import { ILabel, ISample } from '@shared/types'

export interface CvLabelManifestSample extends Omit<ISample, 'imageUri' | 'completedAt'> {
  imageFile: string
}

export type CvLabelManifestTask = {
  id: string
  name: string
  samples: CvLabelManifestSample[]
}

export type CvLabelManifestInput =
  | { kind: 'tasks'; labels: ILabel[]; samples: CvLabelManifestSample[] }
  | { kind: 'project'; project: { name: string }; labels: ILabel[]; tasks: CvLabelManifestTask[] }

const CVLABEL_FORMAT_VERSION = 1

/** Builds manifest.json content for either archive kind - see formats/cvlabel/SPEC.md. */
export const buildCvLabelManifest = (input: CvLabelManifestInput): string => {
  const labels = input.labels.map((label) => ({ id: label.id, name: label.name }))

  return JSON.stringify(
    input.kind === 'tasks'
      ? { version: CVLABEL_FORMAT_VERSION, kind: 'tasks', labels, samples: input.samples }
      : {
          version: CVLABEL_FORMAT_VERSION,
          kind: 'project',
          project: input.project,
          labels,
          tasks: input.tasks
        },
    null,
    2
  )
}

export const cvLabelImagePath = (sampleId: string, extension: string): string =>
  `images/${sampleId}.${extension}`
