import { describe, expect, it } from 'vitest'
import { boundingBoxOf, polygonArea } from '../boundingBox'

describe('boundingBoxOf', () => {
  it('computes the min/max extent regardless of point order', () => {
    expect(
      boundingBoxOf([
        { id: 'p0', x: 110, y: 70 },
        { id: 'p1', x: 10, y: 20 }
      ])
    ).toEqual({ minX: 10, minY: 20, width: 100, height: 50 })
  })
})

describe('polygonArea', () => {
  it('computes a simple polygon area via the shoelace formula', () => {
    expect(
      polygonArea([
        { id: 'p0', x: 0, y: 0 },
        { id: 'p1', x: 10, y: 0 },
        { id: 'p2', x: 10, y: 10 },
        { id: 'p3', x: 0, y: 10 }
      ])
    ).toBe(100)
  })
})
