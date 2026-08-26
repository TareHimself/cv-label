import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

/** Hashes a file by streaming it through, never buffering the whole thing in memory. */
export const hashFile = async (filePath: string): Promise<string> => {
  const hash = createHash('sha256')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}
