import { describe, expect, it } from 'vitest'
import { AnnotationType, ILabel, TrainingSplit } from '@shared/types'
import {
  buildCvLabelManifest,
  cvLabelImagePath,
  type CvLabelManifestSample,
  type CvLabelManifestTask
} from '../buildCvLabel'

const labels: ILabel[] = [
  { id: 'l1', name: 'Person', color: '#ff0000' },
  { id: 'l2', name: 'Car', color: '#00ff00' }
]

const sample: CvLabelManifestSample = {
  id: 's1',
  name: 'photo-one',
  split: TrainingSplit.Train,
  annotations: [{ id: 'a1', type: AnnotationType.Box, labelId: 'l1', points: [] }],
  createdAt: '2026-01-01T00:00:00.000Z',
  width: 400,
  height: 300,
  imageFile: 'images/s1.jpg'
}

describe('buildCvLabelManifest', () => {
  it('kind: tasks - trims labels down to id + name, includes the flat sample list as-is', () => {
    const manifest = JSON.parse(buildCvLabelManifest({ kind: 'tasks', labels, samples: [sample] }))

    expect(manifest).toEqual({
      version: 1,
      kind: 'tasks',
      labels: [
        { id: 'l1', name: 'Person' },
        { id: 'l2', name: 'Car' }
      ],
      samples: [sample]
    })
  })

  it('kind: project - includes the project identity and nests samples under each task', () => {
    const tasks: CvLabelManifestTask[] = [{ id: 't1', name: 'Batch 1', samples: [sample] }]

    const manifest = JSON.parse(
      buildCvLabelManifest({ kind: 'project', project: { name: 'My Project' }, labels, tasks })
    )

    expect(manifest).toEqual({
      version: 1,
      kind: 'project',
      project: { name: 'My Project' },
      labels: [
        { id: 'l1', name: 'Person' },
        { id: 'l2', name: 'Car' }
      ],
      tasks
    })
  })
})

describe('cvLabelImagePath', () => {
  it('nests every image under images/, keyed by sample id', () => {
    expect(cvLabelImagePath('s1', 'jpg')).toBe('images/s1.jpg')
  })
})
