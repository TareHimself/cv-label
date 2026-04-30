import { v7 as uuidv7 } from 'uuid'
import { BoundaryResult } from './types'

export const makeUUID = () => {
  return uuidv7()
}

export const checkBoundaryResult = <T>(result: Promise<BoundaryResult<T>>) =>
  result.then((c) => {
    if (c.ok) {
      return c.data
    }

    throw new Error(c.error)
  })

export const mod = (x: number, m: number) => ((x % m) + m) % m

export const errorToString = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return JSON.stringify(error)
}
