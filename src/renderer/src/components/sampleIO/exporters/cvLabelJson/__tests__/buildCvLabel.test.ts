import { describe, expect, it } from 'vitest'
import { AnnotationType, ILabel, TrainingSplit } from '@shared/types'
import { buildCvLabelManifest, cvLabelImagePath, type CvLabelManifestSample } from '../buildCvLabel'

describe('buildCvLabelManifest', () => {
  it('trims labels down to id + name, and includes the flat sample list as-is', () => {
    const labels: ILabel[] = [
      { id: 'l1', name: 'Person', color: '#ff0000' },
      { id: 'l2', name: 'Car', color: '#00ff00' }
    ]
    const samples: CvLabelManifestSample[] = [
      {
        id: 's1',
        name: 'photo-one',
        split: TrainingSplit.Train,
        annotations: [{ id: 'a1', type: AnnotationType.Box, labelId: 'l1', points: [] }],
        createdAt: '2026-01-01T00:00:00.000Z',
        width: 400,
        height: 300,
        imageFile: 'images/s1.jpg'
      }
    ]

    const manifest = JSON.parse(buildCvLabelManifest(labels, samples))

    expect(manifest).toEqual({
      labels: [
        { id: 'l1', name: 'Person' },
        { id: 'l2', name: 'Car' }
      ],
      samples
    })
  })
})

describe('cvLabelImagePath', () => {
  it('nests every image under images/, keyed by sample id', () => {
    expect(cvLabelImagePath('s1', 'jpg')).toBe('images/s1.jpg')
  })
})
