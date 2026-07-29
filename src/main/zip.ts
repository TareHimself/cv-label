import { IPCKeys } from '../shared/types'
import yauzl from 'yauzl'
import fs from 'fs/promises'
import { createWriteStream } from 'fs'
import path from 'path'
import { pipeline } from 'node:stream/promises'
import { handleIpc } from './ipc'

handleIpc(IPCKeys.Zip_ExtractTo, async (filePath, destination) => {
  // adm-zip (used here previously) reads the whole file into memory via fs.readFileSync
  // to parse it, even just to list entries - Node refuses to read anything over 2GiB that
  // way (ERR_FS_FILE_TOO_LARGE), so it can't open real-world datasets past that size at
  // all. yauzl instead seeks directly to the central directory and streams each entry to
  // disk one at a time, so memory use stays flat regardless of archive size.
  const zipfile = await yauzl.openPromise(path.normalize(filePath), {
    lazyEntries: true,
    autoClose: true
  })

  for await (const entry of zipfile.eachEntry()) {
    const entryPath = path.join(destination, entry.fileName)

    // Guards against a malicious/malformed entry (e.g. "../../etc/passwd") writing
    // outside destination - matters here since imported archives (YOLO/COCO/.cvlabel)
    // can come from anywhere, not just this app's own exports.
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
