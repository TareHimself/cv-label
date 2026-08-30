import { IPoint } from '@shared/types'

export type BoundingBox = {
  minX: number
  minY: number
  width: number
  height: number
}

export const boundingBoxOf = (points: IPoint[]): BoundingBox => {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}

/** Shoelace formula for a simple polygon's area. */
export const polygonArea = (points: IPoint[]): number => {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}
