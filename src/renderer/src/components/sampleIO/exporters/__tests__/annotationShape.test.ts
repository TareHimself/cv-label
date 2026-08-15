import { describe, expect, it } from 'vitest'
import { AnnotationType, IAnnotation } from '@shared/types'
import { boundingBoxOf, exportShapePoints, ExportShape, polygonArea } from '../annotationShape'

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

describe('exportShapePoints', () => {
  const box: Pick<IAnnotation, 'type' | 'points'> = {
    type: AnnotationType.Box,
    points: [
      { id: 'p0', x: 100, y: 50 },
      { id: 'p1', x: 300, y: 150 }
    ]
  }
  const polygon: Pick<IAnnotation, 'type' | 'points'> = {
    type: AnnotationType.Polygon,
    points: [
      { id: 'p0', x: 0, y: 0 },
      { id: 'p1', x: 10, y: 0 },
      { id: 'p2', x: 5, y: 10 }
    ]
  }

  it('in Box mode, flattens both Box and Polygon annotations to their bounding rectangle corners', () => {
    expect(exportShapePoints(box, ExportShape.Box)).toEqual([
      { x: 100, y: 50 },
      { x: 300, y: 50 },
      { x: 300, y: 150 },
      { x: 100, y: 150 }
    ])
    expect(exportShapePoints(polygon, ExportShape.Box)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ])
  })

  it('in Segment mode, keeps a Polygon real outline but still boxes a Box (it has no other shape)', () => {
    expect(exportShapePoints(polygon, ExportShape.Segment)).toBe(polygon.points)
    expect(exportShapePoints(box, ExportShape.Segment)).toEqual([
      { x: 100, y: 50 },
      { x: 300, y: 50 },
      { x: 300, y: 150 },
      { x: 100, y: 150 }
    ])
  })
})
