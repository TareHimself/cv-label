import { describe, expect, it } from 'vitest'
import { TrainingSplit } from '@shared/types'
import { splitFromPath } from '../splitFromPath'

describe('splitFromPath', () => {
  it('defaults to Train when no split folder is present', () => {
    expect(splitFromPath('dataset/images/train/img1.jpg')).toBe(TrainingSplit.Train)
    expect(splitFromPath('img1.jpg')).toBe(TrainingSplit.Train)
  })

  it('matches a val/valid/validation folder to Valid', () => {
    expect(splitFromPath('dataset/images/val/img1.jpg')).toBe(TrainingSplit.Valid)
    expect(splitFromPath('dataset/images/valid/img1.jpg')).toBe(TrainingSplit.Valid)
    expect(splitFromPath('dataset/images/validation/img1.jpg')).toBe(TrainingSplit.Valid)
  })

  it('matches a test/testing folder to Test', () => {
    expect(splitFromPath('dataset/images/test/img1.jpg')).toBe(TrainingSplit.Test)
    expect(splitFromPath('dataset/images/testing/img1.jpg')).toBe(TrainingSplit.Test)
  })
})
