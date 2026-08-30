import { describe, expect, it } from 'vitest'
import { AnnotationType, IAnnotation } from '@shared/types'
import { exportShapePoints, ExportShape } from '../annotationShape'

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
