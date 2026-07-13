import sharp from 'sharp'
import JSZip from 'jszip'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Generates a small synthetic YOLO-format dataset (data.yaml + images/ + labels/) zipped up,
 * for use as an import fixture. One class ("stop-sign"), one image with a centered box.
 */
export const createYoloDatasetZip = async (): Promise<string> => {
  const image = await sharp({
    create: { width: 400, height: 300, channels: 3, background: { r: 200, g: 30, b: 30 } }
  })
    .jpeg()
    .toBuffer()

  const zip = new JSZip()
  zip.file('dataset/data.yaml', 'names:\n  0: stop-sign\n')
  zip.file('dataset/images/train/sign-1.jpg', image)
  // Centered box, 40% of the image's width/height.
  zip.file('dataset/labels/train/sign-1.txt', '0 0.5 0.5 0.4 0.4\n')

  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  const dir = mkdtempSync(join(tmpdir(), 'cv-label-yolo-fixture-'))
  const zipPath = join(dir, 'yolo-dataset.zip')
  writeFileSync(zipPath, buffer)
  return zipPath
}

export const cleanupYoloDatasetZip = (zipPath: string) => {
  rmSync(join(zipPath, '..'), { recursive: true, force: true })
}
