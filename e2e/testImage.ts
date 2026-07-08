import sharp from 'sharp'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export type TestImageOptions = {
  width?: number
  height?: number
  color?: { r: number; g: number; b: number }
}

/**
 * Generates a small synthetic JPEG on disk for use as an upload fixture.
 * Generated at test time (via `sharp`, already a project dependency) instead of
 * committing binary assets or depending on the user's own gitignored store/images.
 */
export const createTestImage = async (
  name: string,
  options: TestImageOptions = {}
): Promise<string> => {
  const dir = mkdtempSync(join(tmpdir(), 'cv-label-fixture-'))
  const filePath = join(dir, `${name}.jpg`)

  await sharp({
    create: {
      width: options.width ?? 400,
      height: options.height ?? 300,
      channels: 3,
      background: options.color ?? { r: 120, g: 150, b: 200 }
    }
  })
    .jpeg()
    .toFile(filePath)

  return filePath
}

export const cleanupTestImage = (filePath: string) => {
  rmSync(join(filePath, '..'), { recursive: true, force: true })
}
