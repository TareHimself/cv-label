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

// Comfortably under engines' call-stack-depth limit for a spread argument list.
const CHUNK_SIZE = 0x8000

/** Prefers the native `Uint8Array.prototype.toBase64` (Electron has it, test/dev Node doesn't always) - the fallback chunks to avoid blowing the call stack on a multi-megabyte image. */
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  if (typeof bytes.toBase64 === 'function') return bytes.toBase64()

  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE))
  }
  return btoa(binary)
}

export const errorToString = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return JSON.stringify(error)
}
