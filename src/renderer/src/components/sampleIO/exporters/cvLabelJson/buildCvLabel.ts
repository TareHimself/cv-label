import { ILabel, ISample } from '@shared/types'

export interface CvLabelManifestSample extends Omit<ISample, 'imageUri' | 'completedAt'> {
  imageFile: string
}

/** A flat sample list plus a label list (id + name only, enough for an importer to match
 *  by id then name) - deliberately independent of task structure, so re-importing works
 *  into any project regardless of which tasks the samples originally came from. */
export const buildCvLabelManifest = (labels: ILabel[], samples: CvLabelManifestSample[]): string =>
  JSON.stringify(
    {
      labels: labels.map((label) => ({ id: label.id, name: label.name })),
      samples
    },
    null,
    2
  )

export const cvLabelImagePath = (sampleId: string, extension: string): string =>
  `images/${sampleId}.${extension}`
