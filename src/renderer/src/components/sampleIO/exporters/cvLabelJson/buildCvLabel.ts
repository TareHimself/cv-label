import { ILabel, ISample } from '@shared/types'

export interface CvLabelManifestSample extends Omit<ISample, 'imageUri' | 'completedAt'> {
  imageFile: string
}

export type CvLabelManifestTask = {
  id: string
  name: string
  samples: CvLabelManifestSample[]
}

const CVLABEL_FORMAT_VERSION = 1

/** Builds manifest.json content - see formats/cvlabel/SPEC.md. One shape for both a task selection and a whole project; only which tasks get passed in differs. */
export const buildCvLabelManifest = (labels: ILabel[], tasks: CvLabelManifestTask[]): string =>
  JSON.stringify(
    {
      version: CVLABEL_FORMAT_VERSION,
      labels: labels.map((label) => ({ id: label.id, name: label.name })),
      tasks
    },
    null,
    2
  )

export const cvLabelImagePath = (sampleId: string, extension: string): string =>
  `images/${sampleId}.${extension}`
