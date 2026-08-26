import { IPCKeys } from '../shared/types'
import yauzl from 'yauzl'
import fs from 'fs/promises'
import { createWriteStream } from 'fs'
import path from 'path'
import { pipeline } from 'node:stream/promises'
import { handleIpc } from './ipc'

handleIpc(IPCKeys.Zip_ExtractTo, async (filePath, destination) => {
  // yauzl (unlike adm-zip previously) seeks the central directory and streams entries to disk one at a time, so memory stays flat regardless of archive size.
  const zipfile = await yauzl.openPromise(path.normalize(filePath), {
    lazyEntries: true,
    autoClose: true
  })

  for await (const entry of zipfile.eachEntry()) {
    const entryPath = path.join(destination, entry.fileName)

    // Guards against a malicious/malformed entry (e.g. "../../etc/passwd") writing outside destination - imported archives can come from anywhere.
    if (path.relative(destination, entryPath).startsWith('..')) {
      throw new Error(`Zip entry escapes destination directory: ${entry.fileName}`)
    }

    if (/\/$/.test(entry.fileName)) {
      await fs.mkdir(entryPath, { recursive: true })
      continue
    }

    await fs.mkdir(path.dirname(entryPath), { recursive: true })
    const readStream = await zipfile.openReadStreamPromise(entry)
    await pipeline(readStream, createWriteStream(entryPath))
  }
})
